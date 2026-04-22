import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { MaintenanceManager } from "@/components/maintenance/maintenance-manager";
import { buildStockConsistencyReport } from "@/server/services/stock-maintenance-service";
import { isSuperAdmin } from "@/lib/permissions";

export default async function MaintenancePage() {
  const currentUser = await requireUser();

  if (!isSuperAdmin(currentUser.role)) {
  redirect("/forbidden");
}

  const initialReport = await buildStockConsistencyReport();

  return <MaintenanceManager initialReport={initialReport} />;
}