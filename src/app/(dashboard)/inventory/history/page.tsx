import { requireAdmin } from "@/lib/auth";
import { InventoryHistoryManager } from "@/components/inventory/inventory-history-manager";
import { getInventoryHistoryData } from "@/server/services/inventory-history-service";

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatDateInputValue(date);
}

export default async function InventoryHistoryPage() {
  await requireAdmin();

  const initialData = await getInventoryHistoryData({
    dateFrom: createDateDaysAgo(29),
    dateTo: formatDateInputValue(new Date()),
  });

  return <InventoryHistoryManager initialData={initialData} />;
}