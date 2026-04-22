import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { buildWarehouseReportSummary } from "@/server/services/report-service";

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
    await requireUser();

    const dateFrom = request.nextUrl.searchParams.get("dateFrom");
    const dateTo = request.nextUrl.searchParams.get("dateTo");
    const lowStockThresholdParam = request.nextUrl.searchParams.get(
      "lowStockThreshold"
    );

    const lowStockThreshold =
      lowStockThresholdParam && lowStockThresholdParam.trim()
        ? Number(lowStockThresholdParam)
        : undefined;

    const summary = await buildWarehouseReportSummary({
      dateFrom,
      dateTo,
      lowStockThreshold,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    return handleError(error);
  }
}