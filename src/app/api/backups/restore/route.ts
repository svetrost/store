import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { restoreWarehouseBackupSnapshot } from "@/server/services/backup-service";

export const runtime = "nodejs";

const MAX_BACKUP_FILE_SIZE = 25 * 1024 * 1024;

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

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { success: false, message: "Файл backup содержит некорректный JSON" },
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

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Файл backup не был передан" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, message: "Файл backup пустой" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BACKUP_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "Размер backup-файла не должен превышать 25 МБ" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const payload = JSON.parse(text) as unknown;

    const result = await restoreWarehouseBackupSnapshot(payload, {
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
    });

    return NextResponse.json({
      success: true,
      message: "Восстановление из резервной копии успешно завершено",
      summary: result.summary,
      warnings: result.warnings,
    });
  } catch (error) {
    return handleError(error);
  }
}