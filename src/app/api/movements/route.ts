import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMovementHistoryData } from "@/server/services/movement-history-service";

export const runtime = "nodejs";

const createMovementSchema = z.object({
  barcode: z.string().trim().min(1, "Не указан штрих-код"),
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce
    .number()
    .int("Количество должно быть целым")
    .positive("Количество должно быть больше нуля"),
  note: z.string().max(1000).nullable().optional(),
  source: z.enum(["MANUAL", "SCAN"]).optional().default("MANUAL"),
});

function normalizeNote(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function getSuccessMessage(type: "IN" | "OUT") {
  return type === "IN" ? "Приход сохранён" : "Расход сохранён";
}

function getAuditAction(type: "IN" | "OUT") {
  return type === "IN" ? "MOVEMENT_STOCK_IN" : "MOVEMENT_STOCK_OUT";
}

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 401 }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 403 }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: error.issues[0]?.message ?? "Некорректные данные запроса",
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { success: false, message: "Ошибка сервера" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const data = await getMovementHistoryData({
      search: request.nextUrl.searchParams.get("search"),
      type: request.nextUrl.searchParams.get("type"),
      source: request.nextUrl.searchParams.get("source"),
      dateFrom: request.nextUrl.searchParams.get("dateFrom"),
      dateTo: request.nextUrl.searchParams.get("dateTo"),
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser();
    const body = await request.json();
    const parsed = createMovementSchema.parse(body);
    const note = normalizeNote(parsed.note);

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          barcode: parsed.barcode,
        },
        select: {
          id: true,
          name: true,
          barcode: true,
          quantity: true,
          isArchived: true,
        },
      });

      if (!product) {
        throw new Error("Товар не найден");
      }

      if (product.isArchived) {
        throw new Error("Операции по архивному товару запрещены");
      }

      const balanceBefore = product.quantity;

      if (parsed.type === "OUT" && parsed.quantity > balanceBefore) {
        throw new Error(
          `Недостаточно товара на складе. Доступно: ${balanceBefore}`
        );
      }

      const balanceAfter =
        parsed.type === "IN"
          ? balanceBefore + parsed.quantity
          : balanceBefore - parsed.quantity;

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          performedById: currentUser.id,
          type: parsed.type,
          source: parsed.source,
          quantity: parsed.quantity,
          balanceBefore,
          balanceAfter,
          note,
        },
        select: {
          id: true,
          type: true,
          source: true,
          quantity: true,
          balanceBefore: true,
          balanceAfter: true,
          note: true,
          createdAt: true,
        },
      });

      await tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          quantity: balanceAfter,
          updatedById: currentUser.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: getAuditAction(parsed.type),
          entityType: "StockMovement",
          entityId: movement.id,
          details: {
            movementId: movement.id,
            productId: product.id,
            productName: product.name,
            barcode: product.barcode,
            type: movement.type,
            source: movement.source,
            quantity: movement.quantity,
            balanceBefore: movement.balanceBefore,
            balanceAfter: movement.balanceAfter,
            note: movement.note,
            performedBy: {
              id: currentUser.id,
              name: currentUser.name,
              username: currentUser.username,
              role: currentUser.role,
            },
            createdAt: movement.createdAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        message: getSuccessMessage(parsed.type),
        movement: {
          id: movement.id,
          type: movement.type,
          source: movement.source,
          quantity: movement.quantity,
          balanceBefore: movement.balanceBefore,
          balanceAfter: movement.balanceAfter,
          delta: movement.balanceAfter - movement.balanceBefore,
          note: movement.note ?? null,
          createdAt: movement.createdAt.toISOString(),
          product: {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            isArchived: product.isArchived,
          },
          performedBy: {
            id: currentUser.id,
            name: currentUser.name,
            username: currentUser.username,
          },
        },
      };
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      movement: result.movement,
    });
  } catch (error) {
    return handleError(error);
  }
}