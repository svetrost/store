import type { UserRole } from "@prisma/client";
import type { ComponentProps } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExportsManager } from "@/components/exports/exports-manager";

type ExportUserRole = ComponentProps<typeof ExportsManager>["currentUserRole"];

function normalizeExportUserRole(role: UserRole): ExportUserRole {
  switch (role) {
    case "SUPERADMIN":
      return "ADMIN";
    case "ADMIN":
      return "ADMIN";
    case "USER":
      return "USER";
    default:
      redirect("/dashboard");
  }
}

export default async function ExportsPage() {
  const currentUser = await requireUser();

  const [products, stockMovements, lowStockProducts, auditLogs] =
    await Promise.all([
      prisma.product.count(),
      prisma.stockMovement.count(),
      prisma.product.count({
        where: {
          isArchived: false,
          quantity: {
            lte: 5,
          },
        },
      }),
      prisma.auditLog.count(),
    ]);

  return (
    <ExportsManager
      currentUserRole={normalizeExportUserRole(currentUser.role)}
      initialOverview={{
        products,
        stockMovements,
        lowStockProducts,
        auditLogs,
      }}
    />
  );
}