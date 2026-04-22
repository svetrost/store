"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  InventoryHistoryApiResponse,
  InventoryHistoryData,
  InventoryHistoryResultItem,
  InventoryHistorySession,
} from "@/types/inventory-history";

type InventoryHistoryManagerProps = {
  initialData: InventoryHistoryData;
};

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatDateInputValue(date);
}

function ResultRow({
  item,
}: {
  item: InventoryHistoryResultItem;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-semibold text-slate-900">{item.name}</div>
          <div className="mt-1 text-sm text-slate-600">{item.barcode}</div>
          <div className="mt-1 text-xs text-slate-500">
            Movement ID: {item.movementId}
          </div>
        </div>

        <div
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            item.delta >= 0
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {item.delta >= 0 ? "+" : ""}
          {formatNumber(item.delta)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Было
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {formatNumber(item.balanceBefore)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Стало
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {formatNumber(item.balanceAfter)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Изменение
          </div>
          <div
            className={`mt-2 text-xl font-bold ${
              item.delta >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {item.delta >= 0 ? "+" : ""}
            {formatNumber(item.delta)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
}: {
  session: InventoryHistorySession;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              Сессия инвентаризации
            </span>

            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatDateTime(session.createdAt)}
            </span>
          </div>

          <div className="mt-3 text-sm text-slate-600">
            Пользователь:{" "}
            <span className="font-medium text-slate-900">
              {session.user
                ? `${session.user.name} (@${session.user.username})`
                : "Система"}
            </span>
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Session ID: {session.sessionId}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {expanded ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              Скрыть детали
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Показать детали
            </>
          )}
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Выбрано
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {formatNumber(session.summary.totalSelected)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Скорректировано
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-800">
            {formatNumber(session.summary.adjusted)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Пропущено
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {formatNumber(session.summary.skipped)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Суммарная дельта
          </div>
          <div
            className={`mt-2 text-2xl font-bold ${
              session.summary.totalDelta >= 0
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {session.summary.totalDelta >= 0 ? "+" : ""}
            {formatNumber(session.summary.totalDelta)}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="mt-5">
          {session.hasDetailedResults ? (
            <div className="space-y-3">
              {session.results.map((item) => (
                <ResultRow key={item.movementId} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Для этой старой сессии доступны только общие итоги. Детальный
              состав появился после обновления блока 19 и будет сохраняться для
              новых инвентаризаций.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function InventoryHistoryManager({
  initialData,
}: InventoryHistoryManagerProps) {
  const [data, setData] = useState(initialData);
  const [dateFrom, setDateFrom] = useState(
    initialData.filters.dateFrom ?? createDateDaysAgo(29)
  );
  const [dateTo, setDateTo] = useState(
    initialData.filters.dateTo ?? formatDateInputValue(new Date())
  );
  const [errorText, setErrorText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const activeFilters = useMemo(() => {
    return [`Период: ${dateFrom || "—"} — ${dateTo || "—"}`];
  }, [dateFrom, dateTo]);

  function applyPreset(days: number) {
    const nextDateTo = formatDateInputValue(new Date());
    const nextDateFrom = createDateDaysAgo(days - 1);
    setDateFrom(nextDateFrom);
    setDateTo(nextDateTo);
  }

  async function loadHistory(showToast: boolean) {
    setErrorText("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/inventory/history?dateFrom=${encodeURIComponent(
          dateFrom
        )}&dateTo=${encodeURIComponent(dateTo)}`
      );

      const responseData =
        (await response.json()) as InventoryHistoryApiResponse;

      if (!response.ok || !responseData.success) {
        setErrorText(
          responseData.success === false
            ? responseData.message
            : "Не удалось загрузить историю инвентаризаций"
        );
        return;
      }

      setData(responseData.data);

      if (showToast) {
        toast.success("История инвентаризаций обновлена");
      }
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="История инвентаризаций"
        description="Журнал всех массовых пересчётов остатков с итогами и деталями по скорректированным товарам."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/inventory"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              К инвентаризации
            </Link>

            <button
              type="button"
              onClick={() => void loadHistory(true)}
              disabled={isLoading}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Обновление...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Обновить
                </>
              )}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Сессий</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(data.overview.sessions)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Скорректировано</div>
          <div className="mt-3 text-3xl font-bold text-amber-800">
            {formatNumber(data.overview.adjusted)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Пропущено</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(data.overview.skipped)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Суммарная дельта</div>
          <div
            className={`mt-3 text-3xl font-bold ${
              data.overview.totalDelta >= 0
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {data.overview.totalDelta >= 0 ? "+" : ""}
            {formatNumber(data.overview.totalDelta)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Фильтры</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
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

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadHistory(false)}
              disabled={isLoading}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Применить фильтр
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {activeFilters.map((item) => (
            <div
              key={item}
              className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>

        {errorText ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {data.sessions.length > 0 ? (
          data.sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))
        ) : (
          <EmptyState
            title="История инвентаризаций пуста"
            description="За выбранный период не найдено ни одной сессии инвентаризации."
          />
        )}
      </div>
    </section>
  );
}