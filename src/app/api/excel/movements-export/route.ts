import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMovementsWorkbook } from "@/lib/excel";

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
  return `svetrost-movements-${date}.xlsx`;
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const type = request.nextUrl.searchParams.get("type")?.trim() ?? "";

    const normalizedType =
      type === "IN" || type === "OUT" || type === "ADJUSTMENT" ? type : null;

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(normalizedType ? { type: normalizedType } : {}),
        ...(search
          ? {
              OR: [
                {
                  product: {
                    is: {
                      name: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  product: {
                    is: {
                      barcode: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  performedBy: {
                    is: {
                      name: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  note: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5000,
      include: {
        product: {
          select: {
            name: true,
            barcode: true,
          },
        },
        performedBy: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    });

    const fileBuffer = await buildMovementsWorkbook(movements);

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