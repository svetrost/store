import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { recalculateProductQuantitiesFromMovements } from "@/server/services/stock-maintenance-service";

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

export async function POST() {
  try {
    const currentUser = await requireAdmin();

    const result = await recalculateProductQuantitiesFromMovements({
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      summary: result.summary,
      report: result.report,
    });
  } catch (error) {
    return handleError(error);
  }
}