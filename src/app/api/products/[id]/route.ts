import { ProductCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAdmin,
  requireUser,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProductSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serializeProduct(product: {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  updatedAt: Date;
  isArchived: boolean;
  category: ProductCategory;
}) {
  return {
    ...product,
    updatedAt: product.updatedAt.toISOString(),
  };
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
        message: error.issues[0]?.message ?? "Некорректные данные",
      },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message === "Товар не найден") {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 404 }
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

export async function GET(_: Request, context: RouteContext) {
  try {
    await requireUser();

    const { id } = await context.params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        quantity: true,
        updatedAt: true,
        isArchived: true,
        category: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Товар не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product: serializeProduct(product),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await context.params;
    const rawBody = await request.json();

    const { category, ...productPayload } = z
      .object({
        category: z.nativeEnum(ProductCategory).optional(),
      })
      .passthrough()
      .parse(rawBody);

    const body = updateProductSchema.parse(productPayload);

    const product = await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findFirst({
        where: {
          id,
          isArchived: false,
        },
        select: {
          id: true,
          name: true,
          barcode: true,
          quantity: true,
          category: true,
          isArchived: true,
        },
      });

      if (!existingProduct) {
        throw new Error("Товар не найден");
      }

      const updatedProduct = await tx.product.update({
        where: { id: existingProduct.id },
        data: {
          name: body.name,
          quantity: body.quantity,
          ...(category ? { category } : {}),
          updatedById: currentUser.id,
        },
        select: {
          id: true,
          name: true,
          barcode: true,
          quantity: true,
          updatedAt: true,
          isArchived: true,
          category: true,
        },
      });

      const quantityDelta = body.quantity - existingProduct.quantity;

      if (quantityDelta !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: existingProduct.id,
            performedById: currentUser.id,
            type: "ADJUSTMENT",
            source: "ADMIN_EDIT",
            quantity: quantityDelta,
            balanceBefore: existingProduct.quantity,
            balanceAfter: body.quantity,
            note:
              body.note?.trim() || "Корректировка остатка администратором",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "PRODUCT_UPDATE",
          entityType: "Product",
          entityId: existingProduct.id,
          details: {
            before: {
              name: existingProduct.name,
              quantity: existingProduct.quantity,
              barcode: existingProduct.barcode,
              category: existingProduct.category,
            },
            after: {
              name: updatedProduct.name,
              quantity: updatedProduct.quantity,
              barcode: updatedProduct.barcode,
              category: updatedProduct.category,
            },
            note: body.note?.trim() || null,
          },
        },
      });

      return updatedProduct;
    });

    return NextResponse.json({
      success: true,
      product: serializeProduct(product),
    });
  } catch (error) {
    return handleError(error);
  }
}