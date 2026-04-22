import { ProductCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAdmin,
  requireUser,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueBarcode } from "@/lib/barcode";
import { createProductSchema } from "@/lib/validators";

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

  return NextResponse.json(
    { success: false, message: "Ошибка сервера" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

    const products = await prisma.product.findMany({
      where: {
        isArchived: false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { barcode: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: {
        updatedAt: "desc",
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

    return NextResponse.json({
      success: true,
      products: products.map(serializeProduct),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin();
    const rawBody = await request.json();

    const { category, ...productPayload } = z
      .object({
        category: z.nativeEnum(ProductCategory),
      })
      .passthrough()
      .parse(rawBody);

    const body = createProductSchema.parse(productPayload);

    const product = await prisma.$transaction(async (tx) => {
      const barcode = await generateUniqueBarcode(tx);

      const createdProduct = await tx.product.create({
        data: {
          name: body.name,
          barcode,
          quantity: body.quantity,
          category,
          createdById: currentUser.id,
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

      if (body.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            productId: createdProduct.id,
            performedById: currentUser.id,
            type: "ADJUSTMENT",
            source: "ADMIN_EDIT",
            quantity: body.quantity,
            balanceBefore: 0,
            balanceAfter: body.quantity,
            note: body.note?.trim() || "Начальный остаток при создании товара",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "PRODUCT_CREATE",
          entityType: "Product",
          entityId: createdProduct.id,
          details: {
            name: createdProduct.name,
            barcode: createdProduct.barcode,
            quantity: createdProduct.quantity,
            category: createdProduct.category,
          },
        },
      });

      return createdProduct;
    });

    return NextResponse.json(
      {
        success: true,
        product: serializeProduct(product),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}