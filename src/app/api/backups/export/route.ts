import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWarehouseBackupSnapshot } from "@/server/services/backup-service";

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

function buildFileName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `svetrost-backup-${timestamp}.json`;
}

export async function GET() {
  try {
    const currentUser = await requireAdmin();

    const snapshot = await buildWarehouseBackupSnapshot({
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "BACKUP_EXPORT",
        entityType: "System",
        details: {
          exportedAt: new Date().toISOString(),
          summary: {
            users: snapshot.data.users.length,
            products: snapshot.data.products.length,
            stockMovements: snapshot.data.stockMovements.length,
            auditLogs: snapshot.data.auditLogs.length,
          },
        } as Prisma.InputJsonValue,
      },
    });

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildFileName()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}