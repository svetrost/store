import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import {
  createUserByAdmin,
  getUsersManagementData,
} from "@/server/services/user-management-service";

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

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: error.issues[0]?.message ?? "Некорректные данные запроса",
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

export async function GET() {
  try {
    await requireAdmin();

    const data = await getUsersManagementData();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const body = await request.json();

    const result = await createUserByAdmin(body, {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      role: "ADMIN",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    return handleError(error);
  }
}