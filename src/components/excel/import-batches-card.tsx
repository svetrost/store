import { FileSpreadsheet } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ImportBatchListItem } from "@/types/excel";

type ImportBatchesCardProps = {
  batches: ImportBatchListItem[];
};

function getStatusBadgeClass(status: ImportBatchListItem["status"]) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700";
    case "FAILED":
      return "bg-rose-100 text-rose-700";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getStatusLabel(status: ImportBatchListItem["status"]) {
  switch (status) {
    case "COMPLETED":
      return "Завершён";
    case "FAILED":
      return "Ошибка";
    case "PENDING":
      return "В обработке";
    default:
      return status;
  }
}

export function ImportBatchesCard({
  batches,
}: ImportBatchesCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <FileSpreadsheet className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Последние импорты Excel
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            История пакетных загрузок движений товаров.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {batches.length > 0 ? (
          batches.map((batch) => (
            <div
              key={batch.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    {batch.fileName}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Импортировал: {batch.importedBy.name} (@{batch.importedBy.username})
                  </div>
                </div>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                    batch.status
                  )}`}
                >
                  {getStatusLabel(batch.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-4">
                <div>Всего: {batch.rowsTotal}</div>
                <div>Успешно: {batch.rowsSuccess}</div>
                <div>Ошибок: {batch.rowsFailed}</div>
                <div>{formatDateTime(batch.createdAt)}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            Импорты Excel пока не выполнялись.
          </div>
        )}
      </div>
    </div>
  );
}