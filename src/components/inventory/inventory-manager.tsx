"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  InventoryApplyApiResponse,
  InventoryApplySummary,
  InventoryProductOption,
} from "@/types/inventory";

type InventoryManagerProps = {
  initialProducts: InventoryProductOption[];
};

type SelectedInventoryRow = {
  productId: string;
  name: string;
  barcode: string;
  currentQuantity: number;
  factualQuantity: string;
  note: string;
};

function getDeltaPreview(currentQuantity: number, factualQuantity: string) {
  const parsed = Number(factualQuantity);

  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed - currentQuantity;
}

export function InventoryManager({
  initialProducts,
}: InventoryManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [selectedRows, setSelectedRows] = useState<SelectedInventoryRow[]>([]);
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSummary, setLastSummary] = useState<InventoryApplySummary | null>(
    null
  );

  const selectedIds = useMemo(
    () => new Set(selectedRows.map((row) => row.productId)),
    [selectedRows]
  );

  const availableProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products
      .filter((product) => {
        if (selectedIds.has(product.id)) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.barcode.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 30);
  }, [products, query, selectedIds]);

  const rowsWithDifference = useMemo(() => {
    return selectedRows.filter((row) => {
      const delta = getDeltaPreview(row.currentQuantity, row.factualQuantity);
      return delta !== null && delta !== 0;
    }).length;
  }, [selectedRows]);

  const totalDeltaPreview = useMemo(() => {
    return selectedRows.reduce((sum, row) => {
      const delta = getDeltaPreview(row.currentQuantity, row.factualQuantity);
      return sum + (delta ?? 0);
    }, 0);
  }, [selectedRows]);

  function addProduct(product: InventoryProductOption) {
    setSelectedRows((previous) => [
      ...previous,
      {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        currentQuantity: product.quantity,
        factualQuantity: String(product.quantity),
        note: "",
      },
    ]);

    setQuery("");
    setErrorText("");
  }

  function removeRow(productId: string) {
    setSelectedRows((previous) =>
      previous.filter((row) => row.productId !== productId)
    );
  }

  function updateRow(productId: string, patch: Partial<SelectedInventoryRow>) {
    setSelectedRows((previous) =>
      previous.map((row) =>
        row.productId === productId
          ? {
              ...row,
              ...patch,
            }
          : row
      )
    );
  }

  async function applyInventory() {
    setErrorText("");
    setLastSummary(null);

    if (selectedRows.length === 0) {
      setErrorText("Сначала добавь хотя бы один товар в инвентаризацию");
      return;
    }

    if (rowsWithDifference === 0) {
      setErrorText("Нет расхождений для применения");
      return;
    }

    const items = selectedRows.map((row) => {
      const parsedQuantity = Number(row.factualQuantity);

      return {
        productId: row.productId,
        factualQuantity: parsedQuantity,
        note: row.note.trim() || null,
      };
    });

    const hasInvalidQuantity = items.some(
      (item) =>
        !Number.isFinite(item.factualQuantity) ||
        item.factualQuantity < 0 ||
        !Number.isInteger(item.factualQuantity)
    );

    if (hasInvalidQuantity) {
      setErrorText("Укажи корректные целые неотрицательные остатки");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inventory/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      });

      const data = (await response.json()) as InventoryApplyApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось применить инвентаризацию"
        );
        return;
      }

      const updatedAt = new Date().toISOString();
      const updatedResultsMap = new Map(
        data.results.map((item) => [item.productId, item])
      );

      setProducts((previous) =>
        previous.map((product) => {
          const updated = updatedResultsMap.get(product.id);

          if (!updated) {
            return product;
          }

          return {
            ...product,
            quantity: updated.balanceAfter,
            updatedAt,
          };
        })
      );

      setSelectedRows([]);
      setLastSummary(data.summary);
      toast.success(data.message);
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Инвентаризация"
        description="Массовая сверка фактических остатков с автоматическим созданием корректировок по выбранным товарам."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/inventory/history"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              История инвентаризаций
            </Link>

            <button
              type="button"
              onClick={() => void applyInventory()}
              disabled={isSubmitting || selectedRows.length === 0}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Применение...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Применить инвентаризацию
                </>
              )}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Активных товаров</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(products.length)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">В текущей сессии</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(selectedRows.length)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">С расхождением</div>
          <div className="mt-3 text-3xl font-bold text-amber-800">
            {formatNumber(rowsWithDifference)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Суммарная дельта</div>
          <div
            className={`mt-3 text-3xl font-bold ${
              totalDeltaPreview >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {totalDeltaPreview >= 0 ? "+" : ""}
            {formatNumber(totalDeltaPreview)}
          </div>
        </div>
      </div>

      {lastSummary ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          Последняя инвентаризация: обработано{" "}
          <span className="font-semibold">
            {formatNumber(lastSummary.totalSelected)}
          </span>
          , скорректировано{" "}
          <span className="font-semibold">
            {formatNumber(lastSummary.adjusted)}
          </span>
          , без изменений{" "}
          <span className="font-semibold">
            {formatNumber(lastSummary.skipped)}
          </span>
          .
        </div>
      ) : null}

      {errorText ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {errorText}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Search className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Добавить товары в сессию
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Ищи по названию или штрих-коду и добавляй позиции для пересчёта.
              </p>
            </div>
          </div>

          <div className="mt-5 relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например: лампа или 460123..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-11 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Очистить поиск"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {availableProducts.length > 0 ? (
              availableProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {product.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {product.barcode}
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        Текущий остаток:{" "}
                        <span className="font-medium text-slate-900">
                          {formatNumber(product.quantity)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Обновлено: {formatDateTime(product.updatedAt)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="Подходящие товары не найдены"
                description="Измени строку поиска или убери товары из текущей сессии."
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <ClipboardList className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Текущая сессия инвентаризации
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Укажи фактический остаток. Для каждой изменённой позиции будет
                создано движение типа <code>ADJUSTMENT</code>.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {selectedRows.length > 0 ? (
              selectedRows.map((row) => {
                const delta = getDeltaPreview(
                  row.currentQuantity,
                  row.factualQuantity
                );

                return (
                  <div
                    key={row.productId}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {row.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {row.barcode}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRow(row.productId)}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Убрать
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Текущий остаток
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">
                          {formatNumber(row.currentQuantity)}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Фактический остаток
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.factualQuantity}
                          onChange={(event) =>
                            updateRow(row.productId, {
                              factualQuantity: event.target.value,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                        />
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Разница
                        </div>
                        <div
                          className={`mt-2 text-2xl font-bold ${
                            delta === null
                              ? "text-slate-400"
                              : delta > 0
                              ? "text-emerald-700"
                              : delta < 0
                              ? "text-rose-700"
                              : "text-slate-900"
                          }`}
                        >
                          {delta === null
                            ? "—"
                            : `${delta >= 0 ? "+" : ""}${formatNumber(delta)}`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Комментарий
                      </label>
                      <textarea
                        rows={3}
                        value={row.note}
                        onChange={(event) =>
                          updateRow(row.productId, {
                            note: event.target.value,
                          })
                        }
                        placeholder="Например: пересчёт полки 3 / коробка повреждена"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="Сессия пока пустая"
                description="Добавь товары слева, чтобы начать инвентаризацию."
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}