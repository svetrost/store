import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { buildStockConsistencyReport } from "@/server/services/stock-maintenance-service";

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

export async function GET() {
  try {
    await requireAdmin();

    const report = await buildStockConsistencyReport();

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    return handleError(error);
  }
}