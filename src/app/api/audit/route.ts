import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { getAuditLogList } from "@/server/services/audit-service";

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
    await requireAdmin();

    const actorRoleParam = request.nextUrl.searchParams.get("actorRole");
    const actorRole =
      actorRoleParam === "ADMIN" || actorRoleParam === "USER"
        ? actorRoleParam
        : undefined;

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit =
      limitParam && limitParam.trim() ? Number(limitParam.trim()) : undefined;

    const data = await getAuditLogList({
      search: request.nextUrl.searchParams.get("search"),
      action: request.nextUrl.searchParams.get("action"),
      entityType: request.nextUrl.searchParams.get("entityType"),
      actorRole,
      dateFrom: request.nextUrl.searchParams.get("dateFrom"),
      dateTo: request.nextUrl.searchParams.get("dateTo"),
      limit,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error);
  }
}