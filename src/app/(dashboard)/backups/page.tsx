import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BackupsManager } from "@/components/backups/backups-manager";
import { isSuperAdmin } from "@/lib/permissions";

export default async function BackupsPage() {
  const currentUser = await requireUser();

  if (!isSuperAdmin(currentUser.role)) {
  redirect("/forbidden");
}

  const [users, products, stockMovements, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.stockMovement.count(),
    prisma.auditLog.count(),
  ]);

  return (
    <BackupsManager
      initialOverview={{
        users,
        products,
        stockMovements,
        auditLogs,
      }}
    />
  );
}