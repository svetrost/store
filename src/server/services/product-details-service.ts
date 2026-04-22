import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const recentMovementInclude = {
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
} satisfies Prisma.StockMovementInclude;

const auditLogInclude = {
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
    },
  },
} satisfies Prisma.AuditLogInclude;

type RecentMovement = Prisma.StockMovementGetPayload<{
  include: typeof recentMovementInclude;
}>;

type ProductAuditLog = Prisma.AuditLogGetPayload<{
  include: typeof auditLogInclude;
}>;

function normalizeId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Не указан идентификатор товара");
  }

  return normalized;
}

function serializeMovement(movement: RecentMovement) {
  return {
    ...movement,
    createdAt: movement.createdAt.toISOString(),
  };
}

function serializeAuditLog(log: ProductAuditLog) {
  return {
    ...log,
    details: log.details ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function getProductDetailsById(productId: string) {
  const normalizedId = normalizeId(productId);

  const product = await prisma.product.findUnique({
    where: {
      id: normalizedId,
    },
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
          id: true,
          name: true,
          username: true,
          role: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  const [movementStatsRows, recentMovements, auditLogs] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        productId: normalizedId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        quantity: true,
        balanceBefore: true,
        balanceAfter: true,
        createdAt: true,
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        productId: normalizedId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      include: recentMovementInclude,
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: "Product",
        entityId: normalizedId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      include: auditLogInclude,
    }),
  ]);

  let totalIn = 0;
  let totalOut = 0;
  let adjustmentDelta = 0;

  for (const movement of movementStatsRows) {
    if (movement.type === "IN") {
      totalIn += movement.quantity;
    }

    if (movement.type === "OUT") {
      totalOut += movement.quantity;
    }

    if (movement.type === "ADJUSTMENT") {
      adjustmentDelta += movement.balanceAfter - movement.balanceBefore;
    }
  }

  const lastMovement = movementStatsRows[0] ?? null;

  return {
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
    stats: {
      movementsCount: movementStatsRows.length,
      totalIn,
      totalOut,
      adjustmentDelta,
      netChange: totalIn - totalOut + adjustmentDelta,
      lastMovementAt: lastMovement?.createdAt.toISOString() ?? null,
      lastMovementType: lastMovement?.type ?? null,
      lowStock: product.quantity <= 5,
    },
    recentMovements: recentMovements.map(serializeMovement),
    auditLogs: auditLogs.map(serializeAuditLog),
  };
}