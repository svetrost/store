import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseMovementImportFile } from "@/lib/excel";
import { registerStockMovement } from "@/server/services/stock-movement-service";

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

function serializeBatch(batch: {
  id: string;
  fileName: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  rowsTotal: number;
  rowsSuccess: number;
  rowsFailed: number;
  createdAt: Date;
  reportJson: unknown;
  importedBy: {
    id: string;
    name: string;
    username: string;
  };
}) {
  return {
    ...batch,
    createdAt: batch.createdAt.toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Файл не был передан" },
        { status: 400 }
      );
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json(
        {
          success: false,
          message: "Поддерживаются только Excel-файлы .xlsx или .xls",
        },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsedFile = await parseMovementImportFile(fileBuffer);

    if (parsedFile.totalRows === 0) {
      return NextResponse.json(
        { success: false, message: "В Excel-файле нет строк для импорта" },
        { status: 400 }
      );
    }

    const initialBatch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        importedById: currentUser.id,
        status: "PENDING",
        rowsTotal: parsedFile.totalRows,
      },
      include: {
        importedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    const failedRows: Array<{
      rowNumber: number;
      message: string;
      barcode?: string;
    }> = [...parsedFile.errors];

    let rowsSuccess = 0;

    for (const row of parsedFile.rows) {
      try {
        await prisma.$transaction(async (tx) => {
          await registerStockMovement(tx, {
            barcode: row.barcode,
            type: row.type,
            quantity: row.quantity,
            performedById: currentUser.id,
            source: "EXCEL_IMPORT",
            note: row.note,
            importBatchId: initialBatch.id,
          });
        });

        rowsSuccess += 1;
      } catch (error) {
        failedRows.push({
          rowNumber: row.rowNumber,
          barcode: row.barcode,
          message:
            error instanceof Error
              ? error.message
              : "Не удалось обработать строку",
        });
      }
    }

    const rowsFailed = failedRows.length;
    const status =
      rowsSuccess === 0 && rowsFailed > 0 ? "FAILED" : "COMPLETED";

    const updatedBatch = await prisma.importBatch.update({
      where: {
        id: initialBatch.id,
      },
      data: {
        status,
        rowsSuccess,
        rowsFailed,
        reportJson: {
          failedRows,
        },
      },
      include: {
        importedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "EXCEL_IMPORT_MOVEMENTS",
        entityType: "ImportBatch",
        entityId: updatedBatch.id,
        details: {
          fileName: updatedBatch.fileName,
          rowsTotal: updatedBatch.rowsTotal,
          rowsSuccess,
          rowsFailed,
        },
      },
    });

    return NextResponse.json({
      success: true,
      batch: serializeBatch(updatedBatch),
      summary: {
        rowsTotal: updatedBatch.rowsTotal,
        rowsSuccess,
        rowsFailed,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}