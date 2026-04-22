import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ProductArchiveActor = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN";
};

function normalizeId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Не указан идентификатор товара");
  }

  return normalized;
}

export async function setProductArchivedState(
  productId: string,
  shouldArchive: boolean,
  actor: ProductArchiveActor
) {
  const normalizedProductId = normalizeId(productId);

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: {
        id: normalizedProductId,
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        quantity: true,
        isArchived: true,
      },
    });

    if (!product) {
      throw new Error("Товар не найден");
    }

    if (product.isArchived === shouldArchive) {
      throw new Error(
        shouldArchive
          ? "Товар уже находится в архиве"
          : "Товар уже является активным"
      );
    }

    const updatedProduct = await tx.product.update({
      where: {
        id: product.id,
      },
      data: {
        isArchived: shouldArchive,
        updatedById: actor.id,
      },
      select: {
        id: true,
        isArchived: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: shouldArchive ? "PRODUCT_ARCHIVE" : "PRODUCT_RESTORE",
        entityType: "Product",
        entityId: product.id,
        details: {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity: product.quantity,
          previousArchivedState: product.isArchived,
          nextArchivedState: shouldArchive,
          changedBy: {
            id: actor.id,
            name: actor.name,
            username: actor.username,
            role: actor.role,
          },
          changedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message: shouldArchive
        ? "Товар отправлен в архив"
        : "Товар восстановлен из архива",
      product: {
        id: updatedProduct.id,
        isArchived: updatedProduct.isArchived,
        updatedAt: updatedProduct.updatedAt.toISOString(),
      },
    };
  });
}