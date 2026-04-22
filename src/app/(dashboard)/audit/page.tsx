import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";
import { AuditManager } from "@/components/audit/audit-manager";
import { getAuditLogList } from "@/server/services/audit-service";

export default async function AuditPage() {
  const currentUser = await requireUser();

  if (!isSuperAdmin(currentUser.role)) {
    redirect("/forbidden");
  }

  const initialData = await getAuditLogList({
    limit: 50,
  });

  return <AuditManager initialData={initialData} />;
}