import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildProductsWorkbook } from "@/lib/excel";

export const runtime = "nodejs";

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

  return NextResponse.json(
    { success: false, message: "Ошибка сервера" },
    { status: 500 }
  );
}

function createFileName() {
  const date = new Date().toISOString().slice(0, 10);
  return `svetrost-products-${date}.xlsx`;
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
        name: true,
        barcode: true,
        quantity: true,
        updatedAt: true,
      },
    });

    const fileBuffer = await buildProductsWorkbook(products);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${createFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}