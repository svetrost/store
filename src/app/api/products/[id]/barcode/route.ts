import { NextResponse } from "next/server";
import { requireUser, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderBarcodePng } from "@/lib/barcode";

type RouteContext = {
  params: Promise<{
    id: string;
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
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Товар не найден" },
        { status: 404 }
      );
    }

    const imageBuffer = await renderBarcodePng(product.barcode);

    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${product.barcode}.png"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}