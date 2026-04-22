import { prisma } from "@/lib/prisma";

type MovementExportOptions = {
  dateFrom?: string | null;
  dateTo?: string | null;
};

type AuditExportOptions = {
  dateFrom?: string | null;
  dateTo?: string | null;
};

type LowStockExportOptions = {
  lowStockThreshold?: number | null;
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

function normalizeLowStockThreshold(value?: number | null) {
  if (!Number.isFinite(value)) {
    return 5;
  }

  const normalized = Math.floor(Number(value));

  if (normalized < 0) {
    return 0;
  }

  return Math.min(normalized, 1_000_000);
}

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(";") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildCsvContent(headers: string[], rows: unknown[][]) {
  const lines = [
    headers.map(toCsvValue).join(";"),
    ...rows.map((row) => row.map(toCsvValue).join(";")),
  ];

  return `\uFEFF${lines.join("\n")}`;
}

function buildFileName(prefix: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `svetrost-${prefix}-${timestamp}.csv`;
}

export async function buildProductsCsvExport() {
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      barcode: true,
      name: true,
      quantity: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          name: true,
          username: true,
        },
      },
      updatedBy: {
        select: {
          name: true,
          username: true,
        },
      },
    },
  });

  const headers = [
    "ID",
    "Штрих-код",
    "Название",
    "Количество",
    "Архивный",
    "Создан",
    "Обновлён",
    "Создал (имя)",
    "Создал (логин)",
    "Обновил (имя)",
    "Обновил (логин)",
  ];

  const rows = products.map((product) => [
    product.id,
    product.barcode,
    product.name,
    product.quantity,
    product.isArchived,
    product.createdAt.toISOString(),
    product.updatedAt.toISOString(),
    product.createdBy?.name ?? "",
    product.createdBy?.username ?? "",
    product.updatedBy?.name ?? "",
    product.updatedBy?.username ?? "",
  ]);

  return {
    fileName: buildFileName("products"),
    content: buildCsvContent(headers, rows),
    count: products.length,
  };
}

export async function buildMovementsCsvExport(
  options: MovementExportOptions = {}
) {
  const dateFrom = parseDateParam(options.dateFrom, false);
  const dateTo = parseDateParam(options.dateTo, true);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("Дата начала не может быть больше даты окончания");
  }

  const movements = await prisma.stockMovement.findMany({
    where:
      dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      type: true,
      source: true,
      quantity: true,
      balanceBefore: true,
      balanceAfter: true,
      note: true,
      product: {
        select: {
          id: true,
          barcode: true,
          name: true,
        },
      },
      performedBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });

  const headers = [
    "ID",
    "Дата",
    "Тип",
    "Источник",
    "Товар ID",
    "Штрих-код",
    "Название товара",
    "Количество",
    "Баланс до",
    "Баланс после",
    "Комментарий",
    "Пользователь ID",
    "Пользователь",
    "Логин",
  ];

  const rows = movements.map((movement) => [
    movement.id,
    movement.createdAt.toISOString(),
    movement.type,
    movement.source,
    movement.product.id,
    movement.product.barcode,
    movement.product.name,
    movement.quantity,
    movement.balanceBefore,
    movement.balanceAfter,
    movement.note ?? "",
    movement.performedBy.id,
    movement.performedBy.name,
    movement.performedBy.username,
  ]);

  return {
    fileName: buildFileName("movements"),
    content: buildCsvContent(headers, rows),
    count: movements.length,
  };
}

export async function buildLowStockCsvExport(
  options: LowStockExportOptions = {}
) {
  const lowStockThreshold = normalizeLowStockThreshold(
    options.lowStockThreshold
  );

  const products = await prisma.product.findMany({
    where: {
      isArchived: false,
      quantity: {
        lte: lowStockThreshold,
      },
    },
    orderBy: [{ quantity: "asc" }, { name: "asc" }],
    select: {
      id: true,
      barcode: true,
      name: true,
      quantity: true,
      isArchived: true,
      updatedAt: true,
    },
  });

  const headers = [
    "ID",
    "Штрих-код",
    "Название",
    "Количество",
    "Архивный",
    "Обновлён",
  ];

  const rows = products.map((product) => [
    product.id,
    product.barcode,
    product.name,
    product.quantity,
    product.isArchived,
    product.updatedAt.toISOString(),
  ]);

  return {
    fileName: buildFileName(`low-stock-threshold-${lowStockThreshold}`),
    content: buildCsvContent(headers, rows),
    count: products.length,
    lowStockThreshold,
  };
}

export async function buildAuditCsvExport(
  options: AuditExportOptions = {}
) {
  const dateFrom = parseDateParam(options.dateFrom, false);
  const dateTo = parseDateParam(options.dateTo, true);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("Дата начала не может быть больше даты окончания");
  }

  const logs = await prisma.auditLog.findMany({
    where:
      dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
      details: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      },
    },
  });

  const headers = [
    "ID",
    "Дата",
    "Действие",
    "Тип сущности",
    "Entity ID",
    "Пользователь ID",
    "Имя",
    "Логин",
    "Роль",
    "Details JSON",
  ];

  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.action,
    log.entityType,
    log.entityId ?? "",
    log.user?.id ?? "",
    log.user?.name ?? "",
    log.user?.username ?? "",
    log.user?.role ?? "",
    log.details ? JSON.stringify(log.details) : "",
  ]);

  return {
    fileName: buildFileName("audit"),
    content: buildCsvContent(headers, rows),
    count: logs.length,
  };
}