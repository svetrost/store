"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { MovementHistoryItem } from "@/types/movement";
import type {
  ReportSummaryApiResponse,
  ReportTopProductItem,
  WarehouseReportSummary,
} from "@/types/report";

type ReportsManagerProps = {
  initialSummary: WarehouseReportSummary;
};

function getTypeLabel(type: MovementHistoryItem["type"]) {
  switch (type) {
    case "IN":
      return "Приход";
    case "OUT":
      return "Расход";
    case "ADJUSTMENT":
      return "Корректировка";
    default:
      return type;
  }
}

function getSourceLabel(source: MovementHistoryItem["source"]) {
  switch (source) {
    case "MANUAL":
      return "Вручную / USB";
    case "SCAN":
      return "Камера";
    case "EXCEL_IMPORT":
      return "Excel";
    case "ADMIN_EDIT":
      return "Изменение админом";
    default:
      return source;
  }
}

function getTypeBadgeClass(type: MovementHistoryItem["type"]) {
  switch (type) {
    case "IN":
      return "bg-emerald-100 text-emerald-700";
    case "OUT":
      return "bg-rose-100 text-rose-700";
    case "ADJUSTMENT":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatDateInputValue(date);
}

function formatPeriodDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ru-RU");
}

function TopProductsCard({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: ReportTopProductItem[];
  tone: "emerald" | "rose";
}) {
  const maxValue = Math.max(...items.map((item) => item.totalQuantity), 1);

  const barClass =
    tone === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  const chipClass =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-rose-100 text-rose-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>

      <div className="mt-5 space-y-4">
        {items.length > 0 ? (
          items.map((item) => {
            const width = Math.max(
              8,
              Math.round((item.totalQuantity / maxValue) * 100)
            );

            return (
              <div key={item.productId} className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {item.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {item.barcode}
                    </div>
                  </div>

                  <div
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${chipClass}`}
                  >
                    {formatNumber(item.totalQuantity)} шт. /{" "}
                    {formatNumber(item.movementsCount)} оп.
                  </div>
                </div>

                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${barClass}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState
            title="Нет данных"
            description="За выбранный период такие операции не найдены."
          />
        )}
      </div>
    </div>
  );
}

export function ReportsManager({
  initialSummary,
}: ReportsManagerProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [dateFrom, setDateFrom] = useState(
    initialSummary.period.dateFrom ?? ""
  );
  const [dateTo, setDateTo] = useState(initialSummary.period.dateTo ?? "");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(initialSummary.period.lowStockThreshold)
  );
  const [errorText, setErrorText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const activeFiltersText = useMemo(() => {
    return [
      `Период: ${formatPeriodDate(summary.period.dateFrom)} — ${formatPeriodDate(
        summary.period.dateTo
      )}`,
      `Низкий остаток: ≤ ${formatNumber(summary.period.lowStockThreshold)}`,
    ];
  }, [summary.period.dateFrom, summary.period.dateTo, summary.period.lowStockThreshold]);

  async function loadSummary(next?: {
    dateFrom?: string;
    dateTo?: string;
    lowStockThreshold?: string;
  }) {
    const effectiveDateFrom = next?.dateFrom ?? dateFrom;
    const effectiveDateTo = next?.dateTo ?? dateTo;
    const effectiveThreshold = next?.lowStockThreshold ?? lowStockThreshold;

    setErrorText("");
    setIsLoading(true);

    try {
      const params = new URLSearchParams();

      if (effectiveDateFrom.trim()) {
        params.set("dateFrom", effectiveDateFrom.trim());
      }

      if (effectiveDateTo.trim()) {
        params.set("dateTo", effectiveDateTo.trim());
      }

      if (effectiveThreshold.trim()) {
        params.set("lowStockThreshold", effectiveThreshold.trim());
      }

      const response = await fetch(`/api/reports/summary?${params.toString()}`);
      const data = (await response.json()) as ReportSummaryApiResponse;

      if (!response.ok || !data.success) {
        const message =
          data.success === false
            ? data.message
            : "Не удалось загрузить отчёт";
        setErrorText(message);
        return;
      }

      setSummary(data.summary);
      toast.success("Отчёт обновлён");
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(days: number) {
    const nextDateTo = formatDateInputValue(new Date());
    const nextDateFrom = createDateDaysAgo(days - 1);

    setDateFrom(nextDateFrom);
    setDateTo(nextDateTo);

    void loadSummary({
      dateFrom: nextDateFrom,
      dateTo: nextDateTo,
      lowStockThreshold,
    });
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setLowStockThreshold("5");

    void loadSummary({
      dateFrom: "",
      dateTo: "",
      lowStockThreshold: "5",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadSummary();
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Отчёты и аналитика"
        description="Сводка по движениям товаров, проблемным остаткам и самым активным позициям за выбранный период."
        actions={
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Обновление...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Обновить отчёт
              </>
            )}
          </button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <CalendarDays className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Фильтры отчёта
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Можно смотреть аналитику за любой период и менять порог низкого остатка.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Дата от
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Дата до
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Порог низкого остатка
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset(1)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Сегодня
            </button>

            <button
              type="button"
              onClick={() => applyPreset(7)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              7 дней
            </button>

            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              30 дней
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Сбросить
            </button>
          </div>

          {errorText ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorText}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              "Применить фильтры"
            )}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {activeFiltersText.map((text) => (
            <div
              key={text}
              className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {text}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Операций за период</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(summary.totals.movementsCount)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Задействовано товаров</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(summary.totals.productsTouched)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Сумма приходов</div>
          <div className="mt-3 text-3xl font-bold text-emerald-700">
            +{formatNumber(summary.totals.totalIn)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Сумма расходов</div>
          <div className="mt-3 text-3xl font-bold text-rose-700">
            -{formatNumber(summary.totals.totalOut)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Чистое изменение</div>
          <div
            className={`mt-3 text-3xl font-bold ${
              summary.totals.netChange >= 0
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {summary.totals.netChange >= 0 ? "+" : ""}
            {formatNumber(summary.totals.netChange)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Низкий остаток</div>
          <div className="mt-3 text-3xl font-bold text-amber-800">
            {formatNumber(summary.totals.lowStockProducts)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TopProductsCard
          title="Топ по приходу"
          description="Какие товары чаще всего пополнялись за выбранный период."
          items={summary.topIncomingProducts}
          tone="emerald"
        />

        <TopProductsCard
          title="Топ по расходу"
          description="Какие товары чаще всего списывались или выдавались."
          items={summary.topOutgoingProducts}
          tone="rose"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <TriangleAlert className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Товары с низким остатком
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Список формируется по текущему остатку товара, а не только по операциям за период.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {summary.lowStockProducts.length > 0 ? (
            summary.lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {product.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {product.barcode}
                    </div>
                  </div>

                  <div
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      product.quantity === 0
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Остаток: {formatNumber(product.quantity)}
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-500">
                  Обновлено: {formatDateTime(product.updatedAt)}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="Проблемных остатков нет"
              description="По текущему порогу низкого остатка товары не найдены."
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Последние операции
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Последние движения товаров для быстрого контроля.
        </p>

        <div className="mt-5 space-y-3">
          {summary.recentMovements.length > 0 ? (
            summary.recentMovements.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {item.product.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Штрих-код: {item.product.barcode}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTypeBadgeClass(
                        item.type
                      )}`}
                    >
                      {getTypeLabel(item.type)}
                    </span>

                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {getSourceLabel(item.source)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    Количество:{" "}
                    <span className="font-medium text-slate-900">
                      {item.type === "IN" ? "+" : item.type === "OUT" ? "-" : ""}
                      {formatNumber(item.quantity)}
                    </span>
                  </div>
                  <div>
                    Было:{" "}
                    <span className="font-medium text-slate-900">
                      {formatNumber(item.balanceBefore)}
                    </span>
                  </div>
                  <div>
                    Стало:{" "}
                    <span className="font-medium text-slate-900">
                      {formatNumber(item.balanceAfter)}
                    </span>
                  </div>
                  <div>
                    Пользователь:{" "}
                    <span className="font-medium text-slate-900">
                      {item.performedBy.name}
                    </span>
                  </div>
                  <div>{formatDateTime(item.createdAt)}</div>
                </div>

                {item.note ? (
                  <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {item.note}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              title="Операции не найдены"
              description="За выбранный период движений товаров пока нет."
            />
          )}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Эта страница хорошо подходит для ежедневного контроля склада и поиска узких мест.
        </div>
      </div>
    </section>
  );
}