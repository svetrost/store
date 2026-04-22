import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { createQuickMovementForProduct } from "@/server/services/product-quick-movement-service";

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
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await requireUser();
    const { id } = await resolveParams(context.params);
    const body = await request.json();

    const result = await createQuickMovementForProduct(id, body, {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      role: currentUser.role,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      product: result.product,
      movement: result.movement,
    });
  } catch (error) {
    return handleError(error);
  }
}