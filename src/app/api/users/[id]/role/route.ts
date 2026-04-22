import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { updateUserRole } from "@/server/services/user-management-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveParams(
  params: RouteContext["params"]
): Promise<{ id: string }> {
  return await Promise.resolve(params);
}

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

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await resolveParams(context.params);
    const body = await request.json();

    const result = await updateUserRole(id, body, {
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