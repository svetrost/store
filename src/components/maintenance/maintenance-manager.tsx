"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  RecalculateStockApiResponse,
  StockCheckApiResponse,
  StockConsistencyReport,
} from "@/types/maintenance";

type MaintenanceManagerProps = {
  initialReport: StockConsistencyReport;
};

export function MaintenanceManager({
  initialReport,
}: MaintenanceManagerProps) {
  const [report, setReport] = useState(initialReport);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  async function loadReport() {
    setErrorText("");
    setSuccessText("");
    setIsChecking(true);

    try {
      const response = await fetch("/api/maintenance/stock-check");
      const data = (await response.json()) as StockCheckApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось выполнить проверку"
        );
        return;
      }

      setReport(data.report);
      toast.success("Проверка остатков завершена");
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleRecalculate() {
    const confirmed = window.confirm(
      "Пересчитать остатки по последнему движению каждого товара? Это изменит quantity у товаров с расхождениями."
    );

    if (!confirmed) {
      return;
    }

    setErrorText("");
    setSuccessText("");
    setIsRecalculating(true);

    try {
      const response = await fetch("/api/maintenance/recalculate-stock", {
        method: "POST",
      });

      const data = (await response.json()) as RecalculateStockApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось пересчитать остатки"
        );
        return;
      }

      setReport(data.report);
      setSuccessText(
        `${data.message}. Обновлено товаров: ${formatNumber(
          data.summary.updatedProducts
        )}`
      );
      toast.success(data.message);
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsRecalculating(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Сервисные инструменты"
        description="Проверка целостности остатков и безопасный пересчёт quantity по последнему движению товара."
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadReport()}
              disabled={isChecking || isRecalculating}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Проверить снова
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleRecalculate()}
              disabled={isChecking || isRecalculating}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRecalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Пересчёт...
                </>
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Пересчитать остатки
                </>
              )}
            </button>
          </div>
        }
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
        <div className="font-semibold">Важно</div>
        <div className="mt-2">
          Пересчёт меняет только товары, у которых есть движения и найдено
          расхождение между текущим остатком и последним{" "}
          <code>balanceAfter</code>.
        </div>
        <div className="mt-2">
          Товары без движений не изменяются. Перед массовым пересчётом желательно
          сделать backup.
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Всего товаров</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(report.totals.productsTotal)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">С движениями</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(report.totals.productsWithMovements)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Без движений</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(report.totals.productsWithoutMovements)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Архивных товаров</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(report.totals.archivedProducts)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Корректных остатков</div>
          <div className="mt-3 text-3xl font-bold text-emerald-700">
            {formatNumber(report.totals.consistentProducts)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Расхождений найдено</div>
          <div className="mt-3 text-3xl font-bold text-rose-700">
            {formatNumber(report.totals.mismatchedProducts)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Последняя проверка
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {formatDateTime(report.checkedAt)}
            </p>
          </div>

          <div
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              report.totals.mismatchedProducts > 0
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {report.totals.mismatchedProducts > 0
              ? "Есть расхождения"
              : "Расхождений нет"}
          </div>
        </div>

        {errorText ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorText}
          </div>
        ) : null}

        {successText ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successText}
          </div>
        ) : null}
      </div>

      {report.mismatches.length === 0 ? (
        <EmptyState
          title="Расхождений не найдено"
          description="Текущие остатки товаров совпадают с последним движением."
          action={
            <div className="inline-flex items-center rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Всё в порядке
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {report.mismatches.map((item) => (
            <div
              key={item.productId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold text-slate-900">
                      {item.name}
                    </div>

                    {item.isArchived ? (
                      <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        Архивный
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    Штрих-код: {item.barcode}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Product ID: {item.productId}
                  </div>
                </div>

                <div className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  Расхождение:{" "}
                  {item.difference > 0 ? "+" : ""}
                  {formatNumber(item.difference)}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Текущий остаток
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formatNumber(item.currentQuantity)}
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Ожидаемый остаток
                  </div>
                  <div className="mt-2 text-2xl font-bold text-emerald-700">
                    {formatNumber(item.expectedQuantity)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Последнее движение
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {item.lastMovementId ?? "—"}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Дата движения
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {item.lastMovementAt
                      ? formatDateTime(item.lastMovementAt)
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  После пересчёта у этого товара количество станет{" "}
                  <span className="font-semibold">
                    {formatNumber(item.expectedQuantity)}
                  </span>
                  .
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}