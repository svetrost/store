import { requireUser } from "@/lib/auth";
import { MovementsManager } from "@/components/movements/movements-manager";
import { getMovementHistoryData } from "@/server/services/movement-history-service";

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatDateInputValue(date);
}

export default async function MovementsPage() {
  await requireUser();

  const initialData = await getMovementHistoryData({
    dateFrom: createDateDaysAgo(29),
    dateTo: formatDateInputValue(new Date()),
  });

  return <MovementsManager initialData={initialData} />;
}