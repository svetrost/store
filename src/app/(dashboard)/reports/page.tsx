import { requireUser } from "@/lib/auth";
import { ReportsManager } from "@/components/reports/reports-manager";
import { buildWarehouseReportSummary } from "@/server/services/report-service";

export default async function ReportsPage() {
  await requireUser();

  const summary = await buildWarehouseReportSummary({
    lowStockThreshold: 5,
  });

  return <ReportsManager initialSummary={summary} />;
}