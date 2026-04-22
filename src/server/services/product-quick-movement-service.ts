import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const quickMovementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("IN"),
    quantity: z.number().int().positive(),
    note: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    type: z.literal("OUT"),
    quantity: z.number().int().positive(),
    note: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    type: z.literal("ADJUSTMENT"),
    targetQuantity: z.number().int().nonnegative(),
    note: z.string().max(1000).nullable().optional(),
  }),
]);

type QuickMovementInput = z.infer<typeof quickMovementSchema>;
type QuickMovementActorRole = "SUPERADMIN" | "ADMIN" | "USER";

type QuickMovementActor = {
  id: string;
  name: string;
  username: string;
  role: QuickMovementActorRole;
};

function normalizeId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Не указан идентификатор товара");
  }

  return normalized;
}

function normalizeNote(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized ? normalized : null;
}

function canAdjustStock(role: QuickMovementActor["role"]) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

function getAuditAction(type: QuickMovementInput["type"]) {
  switch (type) {
    case "IN":
      return "PRODUCT_QUICK_STOCK_IN";
    case "OUT":
      return "PRODUCT_QUICK_STOCK_OUT";
    case "ADJUSTMENT":
      return "PRODUCT_QUICK_STOCK_ADJUSTMENT";
    default:
      return "PRODUCT_QUICK_MOVEMENT";
  }
}

export async function createQuickMovementForProduct(
  productId: string,
  input: unknown,
  actor: QuickMovementActor
) {
  const normalizedProductId = normalizeId(productId);
  const parsed = quickMovementSchema.parse(input);

  if (parsed.type === "ADJUSTMENT" && !canAdjustStock(actor.role)) {
    throw new Error("Корректировка остатка доступна только администратору");
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: {
        id: normalizedProductId,
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
      throw new Error("Нельзя проводить операции по архивному товару");
    }

    const balanceBefore = product.quantity;
    let balanceAfter = balanceBefore;
    let movementQuantity = 0;
    let source: "MANUAL" | "ADMIN_EDIT" = "MANUAL";
    const note = normalizeNote(parsed.note);

    if (parsed.type === "IN") {
      movementQuantity = parsed.quantity;
      balanceAfter = balanceBefore + parsed.quantity;
      source = "MANUAL";
    }

    if (parsed.type === "OUT") {
      if (parsed.quantity > balanceBefore) {
        throw new Error("Недостаточно остатка для выполнения расхода");
      }

      movementQuantity = parsed.quantity;
      balanceAfter = balanceBefore - parsed.quantity;
      source = "MANUAL";
    }

    if (parsed.type === "ADJUSTMENT") {
      if (parsed.targetQuantity === balanceBefore) {
        throw new Error("Новый остаток совпадает с текущим");
      }

      movementQuantity = Math.abs(parsed.targetQuantity - balanceBefore);
      balanceAfter = parsed.targetQuantity;
      source = "ADMIN_EDIT";
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        performedById: actor.id,
        type: parsed.type,
        source,
        quantity: movementQuantity,
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
        updatedById: actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: getAuditAction(parsed.type),
        entityType: "Product",
        entityId: product.id,
        details: {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          movementId: movement.id,
          movementType: movement.type,
          source: movement.source,
          quantity: movement.quantity,
          balanceBefore: movement.balanceBefore,
          balanceAfter: movement.balanceAfter,
          note: movement.note,
          performedBy: {
            id: actor.id,
            name: actor.name,
            username: actor.username,
            role: actor.role,
          },
          createdAt: movement.createdAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message:
        parsed.type === "IN"
          ? "Приход успешно проведён"
          : parsed.type === "OUT"
          ? "Расход успешно проведён"
          : "Корректировка успешно выполнена",
      product: {
        id: product.id,
        quantity: balanceAfter,
      },
      movement: {
        id: movement.id,
        type: movement.type,
        source: movement.source as "MANUAL" | "ADMIN_EDIT",
        quantity: movement.quantity,
        balanceBefore: movement.balanceBefore,
        balanceAfter: movement.balanceAfter,
        note: movement.note ?? null,
        createdAt: movement.createdAt.toISOString(),
      },
    };
  });
}