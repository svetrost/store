import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueBarcode } from "@/lib/barcode";

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
      { success: false, message: error.issues[0]?.message ?? "Некорректные данные" },
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

export async function POST(_: Request, context: RouteContext) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await context.params;

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
        },
      });

      if (!existingProduct) {
        throw new Error("Товар не найден");
      }

      const newBarcode = await generateUniqueBarcode(tx);

      const updatedProduct = await tx.product.update({
        where: { id: existingProduct.id },
        data: {
          barcode: newBarcode,
          updatedById: currentUser.id,
        },
        select: {
          id: true,
          name: true,
          barcode: true,
          quantity: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "PRODUCT_BARCODE_REGENERATE",
          entityType: "Product",
          entityId: existingProduct.id,
          details: {
            oldBarcode: existingProduct.barcode,
            newBarcode,
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