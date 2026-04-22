import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const inventoryApplySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1, "Не указан товар"),
        factualQuantity: z.number().int().nonnegative(),
        note: z.string().max(1000).nullable().optional(),
      })
    )
    .min(1, "Добавь хотя бы один товар")
    .max(500, "Слишком много товаров в одной инвентаризации"),
});

type InventoryActor = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN";
};

function normalizeNote(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

export async function applyInventoryAdjustments(
  input: unknown,
  actor: InventoryActor
) {
  const parsed = inventoryApplySchema.parse(input);
  const sessionId = randomUUID();

  const deduplicatedItems = Array.from(
    new Map(
      parsed.items.map((item) => [
        item.productId.trim(),
        {
          productId: item.productId.trim(),
          factualQuantity: item.factualQuantity,
          note: normalizeNote(item.note),
        },
      ])
    ).values()
  );

  return await prisma.$transaction(async (tx) => {
    const productIds = deduplicatedItems.map((item) => item.productId);

    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        quantity: true,
        isArchived: true,
      },
    });

    const productsMap = new Map(products.map((product) => [product.id, product]));

    for (const item of deduplicatedItems) {
      const product = productsMap.get(item.productId);

      if (!product) {
        throw new Error("Один из товаров не найден");
      }

      if (product.isArchived) {
        throw new Error(
          `Товар "${product.name}" находится в архиве и не может участвовать в инвентаризации`
        );
      }
    }

    const results: {
      productId: string;
      name: string;
      barcode: string;
      balanceBefore: number;
      balanceAfter: number;
      delta: number;
      movementId: string;
    }[] = [];

    let adjusted = 0;
    let skipped = 0;
    let totalDelta = 0;

    for (const item of deduplicatedItems) {
      const product = productsMap.get(item.productId)!;
      const balanceBefore = product.quantity;
      const balanceAfter = item.factualQuantity;

      if (balanceBefore === balanceAfter) {
        skipped += 1;
        continue;
      }

      const delta = balanceAfter - balanceBefore;

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          performedById: actor.id,
          type: "ADJUSTMENT",
          source: "ADMIN_EDIT",
          quantity: Math.abs(delta),
          balanceBefore,
          balanceAfter,
          note: item.note,
        },
        select: {
          id: true,
        },
      });

      await tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          quantity: balanceAfter,
          updatedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "PRODUCT_INVENTORY_ADJUSTMENT",
          entityType: "Product",
          entityId: product.id,
          details: {
            sessionId,
            productId: product.id,
            productName: product.name,
            barcode: product.barcode,
            balanceBefore,
            balanceAfter,
            delta,
            movementId: movement.id,
            note: item.note,
            performedBy: {
              id: actor.id,
              name: actor.name,
              username: actor.username,
              role: actor.role,
            },
            appliedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      adjusted += 1;
      totalDelta += delta;

      results.push({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        balanceBefore,
        balanceAfter,
        delta,
        movementId: movement.id,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "INVENTORY_BULK_APPLY",
        entityType: "System",
        details: {
          sessionId,
          totalSelected: deduplicatedItems.length,
          adjusted,
          skipped,
          totalDelta,
          productIds: deduplicatedItems.map((item) => item.productId),
          results,
          performedBy: {
            id: actor.id,
            name: actor.name,
            username: actor.username,
            role: actor.role,
          },
          appliedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message:
        adjusted > 0
          ? "Инвентаризация успешно применена"
          : "Расхождений не найдено, корректировки не потребовались",
      summary: {
        totalSelected: deduplicatedItems.length,
        adjusted,
        skipped,
        totalDelta,
      },
      results,
    };
  });
}