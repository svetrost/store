import { NextRequest, NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { getProductDetailsById } from "@/server/services/product-details-service";

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

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await requireUser();

    const { id } = await resolveParams(context.params);
    const data = await getProductDetailsById(id);

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Товар не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error);
  }
}