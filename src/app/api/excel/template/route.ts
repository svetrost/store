import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { buildMovementImportTemplateWorkbook } from "@/lib/excel";

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

  return NextResponse.json(
    { success: false, message: "Ошибка сервера" },
    { status: 500 }
  );
}

export async function GET() {
  try {
    await requireAdmin();

    const fileBuffer = await buildMovementImportTemplateWorkbook();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="svetrost-movements-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}