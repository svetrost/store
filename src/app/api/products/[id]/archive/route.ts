import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { setProductArchivedState } from "@/server/services/product-archive-service";

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

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await resolveParams(context.params);

    const result = await setProductArchivedState(id, true, {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      role: "ADMIN",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      product: result.product,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await resolveParams(context.params);

    const result = await setProductArchivedState(id, false, {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      role: "ADMIN",
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      product: result.product,
    });
  } catch (error) {
    return handleError(error);
  }
}