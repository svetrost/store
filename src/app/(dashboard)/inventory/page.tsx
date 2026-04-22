import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InventoryManager } from "@/components/inventory/inventory-manager";

export default async function InventoryPage() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    where: {
      isArchived: false,
    },
    orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      barcode: true,
      quantity: true,
      isArchived: true,
      updatedAt: true,
    },
  });

  return (
    <InventoryManager
      initialProducts={products.map((product) => ({
        ...product,
        updatedAt: product.updatedAt.toISOString(),
      }))}
    />
  );
}