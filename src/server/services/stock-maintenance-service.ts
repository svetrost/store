import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type MaintenanceActor = {
  id: string;
  name: string;
  username: string;
};

type LatestMovementSnapshot = {
  id: string;
  productId: string;
  balanceAfter: number;
  createdAt: Date;
};

function buildLatestMovementMap(movements: LatestMovementSnapshot[]) {
  const map = new Map<string, LatestMovementSnapshot>();

  for (const movement of movements) {
    if (!map.has(movement.productId)) {
      map.set(movement.productId, movement);
    }
  }

  return map;
}

export async function buildStockConsistencyReport() {
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        quantity: true,
        isArchived: true,
      },
    }),
    prisma.stockMovement.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        productId: true,
        balanceAfter: true,
        createdAt: true,
      },
    }),
  ]);

  const latestMovementMap = buildLatestMovementMap(movements);

  const mismatches = products
    .map((product) => {
      const latestMovement = latestMovementMap.get(product.id);

      if (!latestMovement) {
        return null;
      }

      const expectedQuantity = latestMovement.balanceAfter;
      const difference = expectedQuantity - product.quantity;

      if (difference === 0) {
        return null;
      }

      return {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        isArchived: product.isArchived,
        currentQuantity: product.quantity,
        expectedQuantity,
        difference,
        lastMovementId: latestMovement.id,
        lastMovementAt: latestMovement.createdAt.toISOString(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      const diffCompare = Math.abs(b.difference) - Math.abs(a.difference);

      if (diffCompare !== 0) {
        return diffCompare;
      }

      return a.name.localeCompare(b.name, "ru");
    });

  const productsWithMovements = products.filter((product) =>
    latestMovementMap.has(product.id)
  ).length;

  const productsWithoutMovements = products.length - productsWithMovements;
  const archivedProducts = products.filter((product) => product.isArchived).length;
  const mismatchedProducts = mismatches.length;
  const consistentProducts = products.length - mismatchedProducts;

  return {
    checkedAt: new Date().toISOString(),
    totals: {
      productsTotal: products.length,
      productsWithMovements,
      productsWithoutMovements,
      archivedProducts,
      consistentProducts,
      mismatchedProducts,
    },
    mismatches,
  };
}

export async function recalculateProductQuantitiesFromMovements(
  actor: MaintenanceActor
) {
  const beforeReport = await buildStockConsistencyReport();
  const mismatchesToUpdate = beforeReport.mismatches.filter(
    (item) => item.lastMovementId !== null
  );

  if (mismatchesToUpdate.length === 0) {
    return {
      message: "Расхождений не найдено. Пересчёт не требуется",
      summary: {
        updatedProducts: 0,
        unchangedProducts: beforeReport.totals.productsTotal,
        mismatchedBefore: 0,
      },
      report: beforeReport,
    };
  }

  await prisma.$transaction(async (tx) => {
    for (const item of mismatchesToUpdate) {
      await tx.product.update({
        where: {
          id: item.productId,
        },
        data: {
          quantity: item.expectedQuantity,
          updatedById: actor.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "STOCK_RECALCULATE",
        entityType: "System",
        details: {
          recalculatedAt: new Date().toISOString(),
          recalculatedBy: {
            id: actor.id,
            name: actor.name,
            username: actor.username,
          },
          updatedProducts: mismatchesToUpdate.length,
          mismatches: mismatchesToUpdate.map((item) => ({
            productId: item.productId,
            barcode: item.barcode,
            name: item.name,
            beforeQuantity: item.currentQuantity,
            afterQuantity: item.expectedQuantity,
            difference: item.difference,
            lastMovementId: item.lastMovementId,
            lastMovementAt: item.lastMovementAt,
          })),
        } as Prisma.InputJsonValue,
      },
    });
  });

  const afterReport = await buildStockConsistencyReport();

  return {
    message: "Остатки успешно пересчитаны по последним движениям",
    summary: {
      updatedProducts: mismatchesToUpdate.length,
      unchangedProducts:
        afterReport.totals.productsTotal - mismatchesToUpdate.length,
      mismatchedBefore: beforeReport.totals.mismatchedProducts,
    },
    report: afterReport,
  };
}