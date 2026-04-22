import { prisma } from "@/lib/prisma";

type InventoryHistoryOptions = {
  dateFrom?: string | null;
  dateTo?: string | null;
};

function parseDateParam(value: string | null | undefined, endOfDay: boolean) {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Некорректный формат даты. Используй YYYY-MM-DD");
  }

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error("Не удалось разобрать дату");
  }

  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSafeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toSafeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function getInventoryHistoryData(
  options: InventoryHistoryOptions = {}
) {
  const dateFrom = parseDateParam(options.dateFrom, false);
  const dateTo = parseDateParam(options.dateTo, true);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("Дата начала не может быть больше даты окончания");
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      action: "INVENTORY_BULK_APPLY",
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      },
    },
    take: 100,
  });

  const sessions = logs.map((log) => {
    const details = isRecord(log.details) ? log.details : {};

    const rawResults = Array.isArray(details.results) ? details.results : [];

    const results = rawResults
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }

        return {
          productId: toSafeString(item.productId),
          name: toSafeString(item.name),
          barcode: toSafeString(item.barcode),
          balanceBefore: toSafeNumber(item.balanceBefore),
          balanceAfter: toSafeNumber(item.balanceAfter),
          delta: toSafeNumber(item.delta),
          movementId: toSafeString(item.movementId),
        };
      })
      .filter(
        (
          item
        ): item is {
          productId: string;
          name: string;
          barcode: string;
          balanceBefore: number;
          balanceAfter: number;
          delta: number;
          movementId: string;
        } =>
          Boolean(
            item &&
              item.productId &&
              item.name &&
              item.barcode &&
              item.movementId
          )
      );

    return {
      id: log.id,
      sessionId: toSafeString(details.sessionId) || log.id,
      createdAt: log.createdAt.toISOString(),
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            username: log.user.username,
            role: log.user.role,
          }
        : null,
      summary: {
        totalSelected: toSafeNumber(details.totalSelected),
        adjusted: toSafeNumber(details.adjusted),
        skipped: toSafeNumber(details.skipped),
        totalDelta: toSafeNumber(details.totalDelta),
      },
      results,
      hasDetailedResults: results.length > 0,
    };
  });

  const overview = sessions.reduce(
    (acc, session) => {
      acc.sessions += 1;
      acc.adjusted += session.summary.adjusted;
      acc.skipped += session.summary.skipped;
      acc.totalDelta += session.summary.totalDelta;
      return acc;
    },
    {
      sessions: 0,
      adjusted: 0,
      skipped: 0,
      totalDelta: 0,
    }
  );

  return {
    overview,
    sessions,
    filters: {
      dateFrom: options.dateFrom ?? null,
      dateTo: options.dateTo ?? null,
    },
  };
}