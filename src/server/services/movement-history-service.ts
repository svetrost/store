import { prisma } from "@/lib/prisma";
import type {
  MovementFilterSource,
  MovementFilterType,
} from "@/types/movement-history";

type MovementHistoryOptions = {
  search?: string | null;
  type?: string | null;
  source?: string | null;
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

function normalizeSearch(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeType(value: string | null | undefined): MovementFilterType {
  switch (value) {
    case "IN":
    case "OUT":
    case "ADJUSTMENT":
      return value;
    case "all":
    case undefined:
    case null:
    case "":
      return "all";
    default:
      throw new Error("Некорректный тип движения");
  }
}

function normalizeSource(
  value: string | null | undefined
): MovementFilterSource {
  switch (value) {
    case "MANUAL":
    case "SCAN":
    case "EXCEL_IMPORT":
    case "ADMIN_EDIT":
      return value;
    case "all":
    case undefined:
    case null:
    case "":
      return "all";
    default:
      throw new Error("Некорректный источник движения");
  }
}

export async function getMovementHistoryData(
  options: MovementHistoryOptions = {}
) {
  const search = normalizeSearch(options.search);
  const type = normalizeType(options.type);
  const source = normalizeSource(options.source);
  const dateFrom = parseDateParam(options.dateFrom, false);
  const dateTo = parseDateParam(options.dateTo, true);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("Дата начала не может быть больше даты окончания");
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(type !== "all" ? { type } : {}),
      ...(source !== "all" ? { source } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                product: {
                  is: {
                    name: {
                      contains: search,
                    },
                  },
                },
              },
              {
                product: {
                  is: {
                    barcode: {
                      contains: search,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          barcode: true,
          isArchived: true,
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

  const items = movements.map((movement) => ({
    id: movement.id,
    type: movement.type,
    source: movement.source,
    quantity: movement.quantity,
    balanceBefore: movement.balanceBefore,
    balanceAfter: movement.balanceAfter,
    delta: movement.balanceAfter - movement.balanceBefore,
    note: movement.note ?? null,
    createdAt: movement.createdAt.toISOString(),
    product: {
      id: movement.product.id,
      name: movement.product.name,
      barcode: movement.product.barcode,
      isArchived: movement.product.isArchived,
    },
    performedBy: movement.performedBy
      ? {
          id: movement.performedBy.id,
          name: movement.performedBy.name,
          username: movement.performedBy.username,
        }
      : null,
  }));

  const overview = items.reduce(
    (acc, item) => {
      acc.totalMovements += 1;
      acc.products.add(item.product.id);
      acc.netDelta += item.delta;

      if (item.type === "IN") {
        acc.totalIn += item.quantity;
      }

      if (item.type === "OUT") {
        acc.totalOut += item.quantity;
      }

      if (item.type === "ADJUSTMENT") {
        acc.adjustmentDelta += item.delta;
      }

      return acc;
    },
    {
      totalMovements: 0,
      products: new Set<string>(),
      totalIn: 0,
      totalOut: 0,
      adjustmentDelta: 0,
      netDelta: 0,
    }
  );

  return {
    overview: {
      totalMovements: overview.totalMovements,
      productsCount: overview.products.size,
      totalIn: overview.totalIn,
      totalOut: overview.totalOut,
      adjustmentDelta: overview.adjustmentDelta,
      netDelta: overview.netDelta,
    },
    items,
    filters: {
      search,
      type,
      source,
      dateFrom: options.dateFrom ?? null,
      dateTo: options.dateTo ?? null,
    },
  };
}