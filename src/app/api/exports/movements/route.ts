import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMovementsCsvExport } from "@/server/services/csv-export-service";

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
    const currentUser = await requireUser();

    const dateFrom = request.nextUrl.searchParams.get("dateFrom");
    const dateTo = request.nextUrl.searchParams.get("dateTo");

    const result = await buildMovementsCsvExport({
      dateFrom,
      dateTo,
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "EXPORT_MOVEMENTS",
        entityType: "System",
        details: {
          exportedAt: new Date().toISOString(),
          rows: result.count,
          filters: {
            dateFrom: dateFrom ?? null,
            dateTo: dateTo ?? null,
          },
        } as Prisma.InputJsonValue,
      },
    });

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}