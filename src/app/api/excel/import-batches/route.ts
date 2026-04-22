import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  try {
    await requireAdmin();

    const batches = await prisma.importBatch.findMany({
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        importedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      batches: batches.map((batch) => ({
        ...batch,
        createdAt: batch.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}