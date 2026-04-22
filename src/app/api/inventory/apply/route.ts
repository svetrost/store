import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { applyInventoryAdjustments } from "@/server/services/inventory-service";

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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const body = await request.json();

    const result = await applyInventoryAdjustments(body, {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      role: "ADMIN",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      summary: result.summary,
      results: result.results,
    });
  } catch (error) {
    return handleError(error);
  }
}