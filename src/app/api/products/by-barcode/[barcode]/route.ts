import { NextResponse } from "next/server";
import { requireUser, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    barcode: string;
  }>;
};

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
    const { barcode } = await context.params;
    const decodedBarcode = decodeURIComponent(barcode);

    const product = await prisma.product.findFirst({
      where: {
        barcode: decodedBarcode,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        quantity: true,
        updatedAt: true,
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
      product: {
        ...product,
        updatedAt: product.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}