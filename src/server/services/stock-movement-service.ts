import { MovementSource, Prisma } from "@prisma/client";

type RegisterStockMovementInput = {
  barcode: string;
  type: "IN" | "OUT";
  quantity: number;
  performedById: string;
  source?: MovementSource;
  note?: string | null;
  importBatchId?: string | null;
};

export async function registerStockMovement(
  tx: Prisma.TransactionClient,
  input: RegisterStockMovementInput
) {
  const normalizedBarcode = input.barcode.trim();

  const product = await tx.product.findFirst({
    where: {
      barcode: normalizedBarcode,
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      barcode: true,
      quantity: true,
    },
  });

  if (!product) {
    throw new Error("Товар с таким штрих-кодом не найден");
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Количество должно быть положительным целым числом");
  }

  const balanceBefore = product.quantity;

  let balanceAfter = balanceBefore;

  if (input.type === "IN") {
    balanceAfter = balanceBefore + input.quantity;
  }

  if (input.type === "OUT") {
    if (balanceBefore < input.quantity) {
      throw new Error(
        `Недостаточно товара на складе. Доступно: ${balanceBefore}`
      );
    }

    balanceAfter = balanceBefore - input.quantity;
  }

  await tx.product.update({
    where: {
      id: product.id,
    },
    data: {
      quantity: balanceAfter,
      updatedById: input.performedById,
    },
  });

  const movement = await tx.stockMovement.create({
    data: {
      productId: product.id,
      performedById: input.performedById,
      type: input.type,
      source: input.source ?? "MANUAL",
      quantity: input.quantity,
      balanceBefore,
      balanceAfter,
      note: input.note?.trim() || null,
      importBatchId: input.importBatchId ?? null,
    },
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
  });

  return movement;
}