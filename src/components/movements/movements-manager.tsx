"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Camera,
  CameraOff,
  ClipboardList,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import { CameraBarcodeScanner } from "@/components/scanner/camera-barcode-scanner";
import type { MovementApiResponse } from "@/types/movement";
import type { ProductListItem } from "@/types/product";
import type {
  MovementFilterSource,
  MovementFilterType,
  MovementHistoryApiResponse,
  MovementHistoryData,
  MovementHistoryItem,
} from "@/types/movement-history";

type ProductListItemWithArchive = ProductListItem & {
  isArchived?: boolean;
};

type ProductLookupResponse =
  | {
      success: true;
      product: ProductListItemWithArchive;
    }
  | {
      success: false;
      message: string;
    };

type MovementsManagerProps = {
  initialData: MovementHistoryData;
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

function getSignedQuantityText(item: MovementHistoryItem) {
  if (item.type === "IN") {
    return `+${formatNumber(item.quantity)}`;
  }

  if (item.type === "OUT") {
    return `-${formatNumber(item.quantity)}`;
  }

  return `${item.delta >= 0 ? "+" : ""}${formatNumber(item.delta)}`;
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

function MovementCard({ item }: { item: MovementHistoryItem }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/products/${item.product.id}`}
              className="font-semibold text-slate-900 transition hover:text-teal-700"
            >
              {item.product.name}
            </Link>

            {item.product.isArchived ? (
              <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                Архивный
              </span>
            ) : null}
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
            {getTypeLabel(item.type)} {getSignedQuantityText(item)}
          </span>

          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {getSourceLabel(item.source)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-5">
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
          Дельта:{" "}
          <span
            className={`font-medium ${
              item.delta >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {item.delta >= 0 ? "+" : ""}
            {formatNumber(item.delta)}
          </span>
        </div>

        <div>
          Пользователь:{" "}
          <span className="font-medium text-slate-900">
            {item.performedBy
              ? item.performedBy.name
              : "Система"}
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
  );
}

export function MovementsManager({
  initialData,
}: MovementsManagerProps) {
  const [data, setData] = useState(initialData);

  const [barcode, setBarcode] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<ProductListItemWithArchive | null>(null);
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [inputSource, setInputSource] = useState<"MANUAL" | "SCAN">("MANUAL");

  const [historySearch, setHistorySearch] = useState(
    initialData.filters.search ?? ""
  );
  const [historyType, setHistoryType] = useState<MovementFilterType>(
    initialData.filters.type
  );
  const [historySource, setHistorySource] = useState<MovementFilterSource>(
    initialData.filters.source
  );
  const [dateFrom, setDateFrom] = useState(
    initialData.filters.dateFrom ?? createDateDaysAgo(29)
  );
  const [dateTo, setDateTo] = useState(
    initialData.filters.dateTo ?? formatDateInputValue(new Date())
  );
  const [historyError, setHistoryError] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const numericQuantity = Number(quantity) || 0;
  const selectedProductIsArchived = Boolean(selectedProduct?.isArchived);

  const projectedBalance =
    selectedProduct && numericQuantity > 0
      ? movementType === "IN"
        ? selectedProduct.quantity + numericQuantity
        : selectedProduct.quantity - numericQuantity
      : selectedProduct?.quantity ?? null;

  const activeFilters = useMemo(() => {
    const result: string[] = [];

    if (historySearch.trim()) {
      result.push(`Поиск: ${historySearch.trim()}`);
    }

    if (historyType !== "all") {
      result.push(`Тип: ${getTypeLabel(historyType)}`);
    }

    if (historySource !== "all") {
      result.push(`Источник: ${getSourceLabel(historySource)}`);
    }

    result.push(`Период: ${dateFrom || "—"} — ${dateTo || "—"}`);

    return result;
  }, [dateFrom, dateTo, historySearch, historySource, historyType]);

  async function loadMovements(showToast: boolean) {
    setHistoryError("");
    setIsHistoryLoading(true);

    try {
      const params = new URLSearchParams();

      if (historySearch.trim()) {
        params.set("search", historySearch.trim());
      }

      params.set("type", historyType);
      params.set("source", historySource);

      if (dateFrom) {
        params.set("dateFrom", dateFrom);
      }

      if (dateTo) {
        params.set("dateTo", dateTo);
      }

      const response = await fetch(`/api/movements?${params.toString()}`);
      const responseData = (await response.json()) as MovementHistoryApiResponse;

      if (!response.ok || !responseData.success) {
        setHistoryError(
          responseData.success === false
            ? responseData.message
            : "Не удалось загрузить журнал движений"
        );
        return;
      }

      setData(responseData.data);

      if (showToast) {
        toast.success("Журнал движений обновлён");
      }
    } catch {
      setHistoryError("Ошибка сети или сервера");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function resetHistoryFilters() {
    setHistorySearch("");
    setHistoryType("all");
    setHistorySource("all");
    setDateFrom(createDateDaysAgo(29));
    setDateTo(formatDateInputValue(new Date()));
    setHistoryError("");
  }

  function applyPreset(days: number) {
    const nextDateTo = formatDateInputValue(new Date());
    const nextDateFrom = createDateDaysAgo(days - 1);
    setDateFrom(nextDateFrom);
    setDateTo(nextDateTo);
  }

  async function lookupProduct(
    rawBarcode?: string,
    options?: {
      silentSuccess?: boolean;
      source?: "MANUAL" | "SCAN";
    }
  ) {
    const normalizedBarcode = (rawBarcode ?? barcode).trim();

    if (!normalizedBarcode) {
      setLookupError("Введите штрих-код товара");
      setSelectedProduct(null);
      return;
    }

    setLookupError("");
    setSubmitError("");
    setIsLookupLoading(true);

    try {
      const response = await fetch(
        `/api/products/by-barcode/${encodeURIComponent(normalizedBarcode)}`
      );

      const lookupData = (await response.json()) as ProductLookupResponse;

      if (!response.ok || !lookupData.success) {
        setSelectedProduct(null);
        setLookupError(
          lookupData.success === false
            ? lookupData.message
            : "Товар не найден"
        );
        return;
      }

      setSelectedProduct(lookupData.product);
      setBarcode(lookupData.product.barcode);
      setInputSource(options?.source ?? "MANUAL");

      if (!options?.silentSuccess) {
        toast.success("Товар найден");
      }
    } catch {
      setSelectedProduct(null);
      setLookupError("Не удалось выполнить поиск товара");
    } finally {
      setIsLookupLoading(false);
    }
  }

  async function handleCameraDetected(scannedBarcode: string) {
    setScannerEnabled(false);
    setBarcode(scannedBarcode);
    setLookupError("");
    setSubmitError("");

    toast.success(`Код считан: ${scannedBarcode}`);

    await lookupProduct(scannedBarcode, {
      silentSuccess: true,
      source: "SCAN",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      setSubmitError("Сначала найди товар по штрих-коду");
      return;
    }

    if (selectedProductIsArchived) {
      setSubmitError("Операции по архивному товару запрещены");
      return;
    }

    if (!numericQuantity || numericQuantity <= 0) {
      setSubmitError("Количество должно быть больше нуля");
      return;
    }

    if (movementType === "OUT" && numericQuantity > selectedProduct.quantity) {
      setSubmitError(
        `Недостаточно товара на складе. Доступно: ${selectedProduct.quantity}`
      );
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barcode: selectedProduct.barcode,
          type: movementType,
          quantity: numericQuantity,
          note,
          source: inputSource,
        }),
      });

      const submitData = (await response.json()) as MovementApiResponse;

      if (!response.ok || !submitData.success) {
        setSubmitError(
          submitData.success === false
            ? submitData.message
            : "Не удалось сохранить движение"
        );
        return;
      }

      setSelectedProduct((previous) =>
        previous
          ? {
              ...previous,
              quantity: submitData.movement.balanceAfter,
              updatedAt: submitData.movement.createdAt,
            }
          : previous
      );

      setQuantity("1");
      setNote("");
      setInputSource("MANUAL");

      await loadMovements(false);

      toast.success(
        `${
          movementType === "IN" ? "Приход" : "Расход"
        } сохранён. Новый остаток: ${submitData.movement.balanceAfter}`
      );
    } catch {
      setSubmitError("Ошибка сети или сервера");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Движение товаров"
        description="Регистрируй приход и расход по штрих-коду, используй камеру, ручной ввод или USB-сканер и фильтруй журнал движений."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Открыть товары
            </Link>

            <button
              type="button"
              onClick={() => void loadMovements(true)}
              disabled={isHistoryLoading}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isHistoryLoading ? (
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Движений</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(data.overview.totalMovements)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Товаров в выборке</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(data.overview.productsCount)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Сумма приходов</div>
          <div className="mt-3 text-3xl font-bold text-emerald-700">
            +{formatNumber(data.overview.totalIn)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Сумма расходов</div>
          <div className="mt-3 text-3xl font-bold text-rose-700">
            -{formatNumber(data.overview.totalOut)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Чистая дельта</div>
          <div
            className={`mt-3 text-3xl font-bold ${
              data.overview.netDelta >= 0
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {data.overview.netDelta >= 0 ? "+" : ""}
            {formatNumber(data.overview.netDelta)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Сканер через камеру
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Наведи камеру на штрих-код. После распознавания код
                  подставится автоматически, а товар будет найден.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setScannerEnabled(true)}
                  disabled={scannerEnabled}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Включить камеру
                </button>

                <button
                  type="button"
                  onClick={() => setScannerEnabled(false)}
                  disabled={!scannerEnabled}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CameraOff className="mr-2 h-4 w-4" />
                  Остановить
                </button>
              </div>
            </div>

            <div className="mt-5">
              <CameraBarcodeScanner
                active={scannerEnabled}
                onDetected={(code) => {
                  void handleCameraDetected(code);
                }}
                onError={(message) => {
                  toast.error(message);
                }}
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Если камера не доступна, форма ниже всё равно работает с ручным
              вводом и USB-сканером.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Поиск товара по штрих-коду
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Можно вводить код вручную, использовать USB-сканер или получать
              код автоматически из камеры.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={barcode}
                  onChange={(event) => {
                    setBarcode(event.target.value);
                    setLookupError("");
                    setSubmitError("");
                    setInputSource("MANUAL");

                    if (
                      selectedProduct &&
                      event.target.value.trim() !== selectedProduct.barcode
                    ) {
                      setSelectedProduct(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void lookupProduct(undefined, { source: "MANUAL" });
                    }
                  }}
                  placeholder="Например: SR-250123456"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  void lookupProduct(undefined, { source: "MANUAL" })
                }
                disabled={isLookupLoading}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLookupLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Поиск...
                  </>
                ) : (
                  "Найти товар"
                )}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  inputSource === "SCAN"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Источник:{" "}
                {inputSource === "SCAN" ? "Камера" : "Ручной ввод / USB-сканер"}
              </div>

              {selectedProduct ? (
                <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  Найден товар: {selectedProduct.name}
                </div>
              ) : null}

              {selectedProductIsArchived ? (
                <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Архивный товар
                </div>
              ) : null}
            </div>

            {lookupError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {lookupError}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Операция по товару
            </h2>

            {selectedProduct ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-slate-900">
                    {selectedProduct.name}
                  </div>

                  {selectedProductIsArchived ? (
                    <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      Архивный
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  Штрих-код: {selectedProduct.barcode}
                </div>

                <div className="mt-3 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  Текущий остаток: {formatNumber(selectedProduct.quantity)}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                Сначала найди товар по штрих-коду или отсканируй его камерой.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMovementType("IN")}
                  className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
                    movementType === "IN"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                  Приход
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType("OUT")}
                  className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
                    movementType === "OUT"
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Расход
                </button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Количество
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    setSubmitError("");
                  }}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[1, 5, 10, 20].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setQuantity(String(value))}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {value} шт.
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Комментарий
                </label>
                <textarea
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setSubmitError("");
                  }}
                  placeholder="Например: поставка от поставщика / выдача клиенту"
                  className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              {selectedProduct ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    projectedBalance !== null && projectedBalance < 0
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  Прогнозируемый остаток после операции:{" "}
                  <span className="font-semibold">
                    {projectedBalance !== null
                      ? formatNumber(projectedBalance)
                      : "—"}
                  </span>
                </div>
              ) : null}

              {selectedProductIsArchived ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Этот товар находится в архиве. Операции по нему запрещены до
                  восстановления.
                </div>
              ) : null}

              {submitError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !selectedProduct || selectedProductIsArchived}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : movementType === "IN" ? (
                  "Сохранить приход"
                ) : (
                  "Сохранить расход"
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Последние операции
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            История движений по товарам с фильтрами по поиску, типу, источнику и
            периоду.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Поиск
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Название, штрих-код, комментарий"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-11 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                {historySearch ? (
                  <button
                    type="button"
                    onClick={() => setHistorySearch("")}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                    aria-label="Очистить поиск"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Тип движения
              </label>
              <select
                value={historyType}
                onChange={(event) =>
                  setHistoryType(event.target.value as MovementFilterType)
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="all">Все</option>
                <option value="IN">Приход</option>
                <option value="OUT">Расход</option>
                <option value="ADJUSTMENT">Корректировка</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Источник
              </label>
              <select
                value={historySource}
                onChange={(event) =>
                  setHistorySource(event.target.value as MovementFilterSource)
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="all">Все</option>
                <option value="MANUAL">Вручную / USB</option>
                <option value="SCAN">Камера</option>
                <option value="EXCEL_IMPORT">Excel</option>
                <option value="ADMIN_EDIT">Изменение админом</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadMovements(false)}
                disabled={isHistoryLoading}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Применить
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
                onClick={resetHistoryFilters}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Сбросить фильтры
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

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Показаны последние 200 записей, отсортированные от новых к старым.
          </div>

          {historyError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {historyError}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {data.items.length > 0 ? (
              data.items.map((item) => <MovementCard key={item.id} item={item} />)
            ) : (
              <EmptyState
                title="История движений не найдена"
                description="Либо пока нет операций, либо текущие фильтры ничего не нашли."
              />
            )}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Операции, созданные после сканирования камерой, будут помечаться
            источником «Камера».
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <ClipboardList className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Что уже умеет этот экран
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>поиск товара по штрих-коду;</li>
              <li>сканирование через камеру;</li>
              <li>автоподстановка найденного кода в форму;</li>
              <li>приход и расход с проверкой остатка;</li>
              <li>работа с ручным вводом и USB-сканером;</li>
              <li>история операций с источником ввода;</li>
              <li>фильтрация журнала по типу, источнику и датам;</li>
              <li>переход в карточку товара из истории движений.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}