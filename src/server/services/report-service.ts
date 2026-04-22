import { prisma } from "@/lib/prisma";

type BuildWarehouseReportSummaryOptions = {
  dateFrom?: string | null;
  dateTo?: string | null;
  lowStockThreshold?: number;
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

function serializeMovement(movement: {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  source: "MANUAL" | "SCAN" | "EXCEL_IMPORT" | "ADMIN_EDIT";
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  createdAt: Date;
  product: {
    id: string;
    name: string;
    barcode: string;
  };
  performedBy: {
    id: string;
    name: string;
    username: string;
  };
}) {
  return {
    ...movement,
    createdAt: movement.createdAt.toISOString(),
  };
}

export async function buildWarehouseReportSummary(
  options: BuildWarehouseReportSummaryOptions = {}
) {
  const dateFrom = parseDateParam(options.dateFrom, false);
  const dateTo = parseDateParam(options.dateTo, true);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("Дата начала не может быть больше даты окончания");
  }

  const lowStockThreshold = normalizeLowStockThreshold(
    options.lowStockThreshold
  );

  const createdAtFilter =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        }
      : undefined;

  const [movements, lowStockProductsPreview, lowStockProductsCount] =
    await Promise.all([
      prisma.stockMovement.findMany({
        where: createdAtFilter
          ? {
              createdAt: createdAtFilter,
            }
          : undefined,
        orderBy: {
          createdAt: "desc",
        },
        take: 10_000,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              barcode: true,
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
      }),
      prisma.product.findMany({
        where: {
          isArchived: false,
          quantity: {
            lte: lowStockThreshold,
          },
        },
        orderBy: [{ quantity: "asc" }, { updatedAt: "desc" }],
        take: 20,
        select: {
          id: true,
          name: true,
          barcode: true,
          quantity: true,
          updatedAt: true,
        },
      }),
      prisma.product.count({
        where: {
          isArchived: false,
          quantity: {
            lte: lowStockThreshold,
          },
        },
      }),
    ]);

  const touchedProductIds = new Set<string>();
  const incomingMap = new Map<
    string,
    {
      productId: string;
      name: string;
      barcode: string;
      totalQuantity: number;
      movementsCount: number;
    }
  >();
  const outgoingMap = new Map<
    string,
    {
      productId: string;
      name: string;
      barcode: string;
      totalQuantity: number;
      movementsCount: number;
    }
  >();

  let totalIn = 0;
  let totalOut = 0;
  let adjustmentDelta = 0;

  for (const movement of movements) {
    touchedProductIds.add(movement.product.id);

    if (movement.type === "IN") {
      totalIn += movement.quantity;

      const previous = incomingMap.get(movement.product.id);

      incomingMap.set(movement.product.id, {
        productId: movement.product.id,
        name: movement.product.name,
        barcode: movement.product.barcode,
        totalQuantity: (previous?.totalQuantity ?? 0) + movement.quantity,
        movementsCount: (previous?.movementsCount ?? 0) + 1,
      });
    }

    if (movement.type === "OUT") {
      totalOut += movement.quantity;

      const previous = outgoingMap.get(movement.product.id);

      outgoingMap.set(movement.product.id, {
        productId: movement.product.id,
        name: movement.product.name,
        barcode: movement.product.barcode,
        totalQuantity: (previous?.totalQuantity ?? 0) + movement.quantity,
        movementsCount: (previous?.movementsCount ?? 0) + 1,
      });
    }

    if (movement.type === "ADJUSTMENT") {
      adjustmentDelta += movement.balanceAfter - movement.balanceBefore;
    }
  }

  const topIncomingProducts = [...incomingMap.values()]
    .sort((a, b) => {
      if (b.totalQuantity !== a.totalQuantity) {
        return b.totalQuantity - a.totalQuantity;
      }

      return b.movementsCount - a.movementsCount;
    })
    .slice(0, 10);

  const topOutgoingProducts = [...outgoingMap.values()]
    .sort((a, b) => {
      if (b.totalQuantity !== a.totalQuantity) {
        return b.totalQuantity - a.totalQuantity;
      }

      return b.movementsCount - a.movementsCount;
    })
    .slice(0, 10);

  return {
    period: {
      dateFrom: options.dateFrom ?? null,
      dateTo: options.dateTo ?? null,
      lowStockThreshold,
    },
    totals: {
      movementsCount: movements.length,
      productsTouched: touchedProductIds.size,
      totalIn,
      totalOut,
      netChange: totalIn - totalOut + adjustmentDelta,
      lowStockProducts: lowStockProductsCount,
    },
    topIncomingProducts,
    topOutgoingProducts,
    lowStockProducts: lowStockProductsPreview.map((product) => ({
      ...product,
      updatedAt: product.updatedAt.toISOString(),
    })),
    recentMovements: movements.slice(0, 20).map(serializeMovement),
  };
}