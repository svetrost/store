"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Boxes,
  Download,
  FileSpreadsheet,
  Loader2,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { formatNumber } from "@/lib/format";
import type {
  ExportErrorApiResponse,
  ExportOverview,
  ExportUserRole,
} from "@/types/export";

type ExportsManagerProps = {
  initialOverview: ExportOverview;
  currentUserRole: ExportUserRole;
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

export function ExportsManager({
  initialOverview,
  currentUserRole,
}: ExportsManagerProps) {
  const [overview] = useState(initialOverview);
  const [dateFrom, setDateFrom] = useState(createDateDaysAgo(29));
  const [dateTo, setDateTo] = useState(formatDateInputValue(new Date()));
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [errorText, setErrorText] = useState("");
  const [activeDownloadKey, setActiveDownloadKey] = useState<string | null>(null);

  const activeFilters = useMemo(() => {
    return [
      `Период: ${dateFrom || "—"} — ${dateTo || "—"}`,
      `Низкий остаток: ≤ ${lowStockThreshold || "5"}`,
    ];
  }, [dateFrom, dateTo, lowStockThreshold]);

  function applyPreset(days: number) {
    const nextDateTo = formatDateInputValue(new Date());
    const nextDateFrom = createDateDaysAgo(days - 1);

    setDateFrom(nextDateFrom);
    setDateTo(nextDateTo);
  }

  async function downloadFile(url: string, key: string, successMessage: string) {
    setErrorText("");
    setActiveDownloadKey(key);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const errorData = (await response.json()) as ExportErrorApiResponse;
          setErrorText(errorData.message ?? "Не удалось выполнить экспорт");
        } else {
          setErrorText("Не удалось выполнить экспорт");
        }

        return;
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const contentDisposition =
        response.headers.get("content-disposition") ?? "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const fileName = fileNameMatch?.[1] ?? `${key}-${Date.now()}.csv`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast.success(successMessage);
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setActiveDownloadKey(null);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Экспорт данных"
        description="Выгрузка товаров, движений, дефицитных позиций и журнала аудита в CSV для Excel и внешней обработки."
        actions={
          <button
            type="button"
            onClick={() =>
              void downloadFile(
                "/api/exports/products",
                "products",
                "Экспорт товаров готов"
              )
            }
            disabled={activeDownloadKey !== null}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeDownloadKey === "products" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Подготовка...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Быстрый экспорт товаров
              </>
            )}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Товаров</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.products)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Движений</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.stockMovements)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Низкий остаток</div>
          <div className="mt-3 text-3xl font-bold text-amber-800">
            {formatNumber(overview.lowStockProducts)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Записей аудита</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.auditLogs)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Фильтры экспорта</h2>
        <p className="mt-2 text-sm text-slate-600">
          Период применяется к выгрузке движений и аудита. Порог применяется к
          выгрузке дефицитных товаров.
        </p>

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

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Boxes className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Экспорт товаров
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Полный список товаров с количеством, архивным статусом и служебными датами.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void downloadFile(
                "/api/exports/products",
                "products",
                "CSV с товарами скачан"
              )
            }
            disabled={activeDownloadKey !== null}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeDownloadKey === "products" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Подготовка...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Скачать товары
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <ArrowLeftRight className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Экспорт движений
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Выгрузка прихода, расхода и корректировок за выбранный период.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void downloadFile(
                `/api/exports/movements?dateFrom=${encodeURIComponent(
                  dateFrom
                )}&dateTo=${encodeURIComponent(dateTo)}`,
                "movements",
                "CSV с движениями скачан"
              )
            }
            disabled={activeDownloadKey !== null}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeDownloadKey === "movements" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Подготовка...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Скачать движения
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <TriangleAlert className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Экспорт дефицитных товаров
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Только неархивные товары, у которых остаток меньше или равен порогу.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void downloadFile(
                `/api/exports/low-stock?lowStockThreshold=${encodeURIComponent(
                  lowStockThreshold || "5"
                )}`,
                "low-stock",
                "CSV с дефицитными товарами скачан"
              )
            }
            disabled={activeDownloadKey !== null}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeDownloadKey === "low-stock" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Подготовка...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Скачать дефицитные товары
              </>
            )}
          </button>
        </div>

        {currentUserRole === "ADMIN" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Shield className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Экспорт аудита
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Администраторская выгрузка журнала действий за выбранный период.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void downloadFile(
                  `/api/exports/audit?dateFrom=${encodeURIComponent(
                    dateFrom
                  )}&dateTo=${encodeURIComponent(dateTo)}`,
                  "audit",
                  "CSV с журналом аудита скачан"
                )
              }
              disabled={activeDownloadKey !== null}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activeDownloadKey === "audit" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Подготовка...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Скачать аудит
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Что важно</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>CSV экспортируется в UTF-8 с BOM, чтобы Excel корректно открывал кириллицу.</li>
          <li>Экспорт аудита доступен только администратору.</li>
          <li>Все выгрузки логируются в журнале аудита.</li>
        </ul>
      </div>
    </section>
  );
}