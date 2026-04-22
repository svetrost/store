"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Copy,
  History,
  Loader2,
  Package2,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ProductQuickMovementDialog } from "@/components/products/product-quick-movement-dialog";
import { ProductArchiveToggleButton } from "@/components/products/product-archive-toggle-button";
import type {
  ProductAuditLogItem,
  ProductDetailsApiResponse,
  ProductDetailsData,
  ProductMovementItem,
} from "@/types/product-details";
import type { UserRole } from "@prisma/client";

type ProductDetailsManagerProps = {
  initialData: ProductDetailsData;
  currentUserRole: UserRole;
};

function getMovementTypeLabel(type: ProductMovementItem["type"]) {
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

function getMovementSourceLabel(source: ProductMovementItem["source"]) {
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

function getMovementTypeBadgeClass(type: ProductMovementItem["type"]) {
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

function getAuditActionBadgeClass(action: string) {
  if (action.startsWith("PRODUCT_")) {
    return "bg-teal-100 text-teal-700";
  }

  if (action.startsWith("MOVEMENT_")) {
    return "bg-violet-100 text-violet-700";
  }

  return "bg-slate-100 text-slate-700";
}

function stringifyDetails(details: unknown) {
  if (details === null || details === undefined) {
    return "Нет дополнительных данных";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function AuditLogCard({ item }: { item: ProductAuditLogItem }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getAuditActionBadgeClass(
                item.action
              )}`}
            >
              {item.action}
            </span>

            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {item.entityType}
            </span>
          </div>

          <div className="mt-3 text-sm text-slate-600">
            Пользователь:{" "}
            <span className="font-medium text-slate-900">
              {item.user
                ? `${item.user.name} (@${item.user.username})`
                : "Система"}
            </span>
          </div>

          <div className="mt-1 text-sm text-slate-600">
            Entity ID:{" "}
            <span className="font-medium text-slate-900">
              {item.entityId ?? "—"}
            </span>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          {formatDateTime(item.createdAt)}
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          Показать details
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
          {stringifyDetails(item.details)}
        </pre>
      </details>
    </div>
  );
}

export function ProductDetailsManager({
  initialData,
  currentUserRole,
}: ProductDetailsManagerProps) {
  const [data, setData] = useState(initialData);
  const [errorText, setErrorText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickMovementOpen, setIsQuickMovementOpen] = useState(false);

  async function loadData(showToast: boolean) {
    setErrorText("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/products/${data.product.id}/details`);
      const responseData = (await response.json()) as ProductDetailsApiResponse;

      if (!response.ok || !responseData.success) {
        setErrorText(
          responseData.success === false
            ? responseData.message
            : "Не удалось загрузить данные товара"
        );
        return;
      }

      setData(responseData.data);

      if (showToast) {
        toast.success("Данные товара обновлены");
      }
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshData() {
    await loadData(true);
  }

  async function syncAfterMovement() {
    await loadData(false);
  }

  async function copyBarcode() {
    try {
      await navigator.clipboard.writeText(data.product.barcode);
      toast.success("Штрих-код скопирован");
    } catch {
      toast.error("Не удалось скопировать штрих-код");
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={data.product.name}
        description={`Штрих-код: ${data.product.barcode}`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к товарам
            </Link>

            <ProductArchiveToggleButton
              productId={data.product.id}
              isArchived={data.product.isArchived}
              canManage={currentUserRole === "ADMIN"}
              onSuccess={async () => {
                await loadData(false);
              }}
            />

            {!data.product.isArchived ? (
              <button
                type="button"
                onClick={() => setIsQuickMovementOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Операция
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void copyBarcode()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Copy className="mr-2 h-4 w-4" />
              Копировать штрих-код
            </button>

            <button
              type="button"
              onClick={() => void refreshData()}
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

      {errorText ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {errorText}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Текущий остаток</div>
          <div
            className={`mt-3 text-3xl font-bold ${
              data.stats.lowStock ? "text-amber-800" : "text-slate-900"
            }`}
          >
            {formatNumber(data.product.quantity)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Операций по товару</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(data.stats.movementsCount)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Всего приход</div>
          <div className="mt-3 text-3xl font-bold text-emerald-700">
            +{formatNumber(data.stats.totalIn)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Всего расход</div>
          <div className="mt-3 text-3xl font-bold text-rose-700">
            -{formatNumber(data.stats.totalOut)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Package2 className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Карточка товара
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Основная информация и служебные данные по позиции.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Название
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {data.product.name}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Штрих-код
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {data.product.barcode}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Статус
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.product.isArchived ? (
                  <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    Архивный
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Активный
                  </span>
                )}

                {data.stats.lowStock ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Низкий остаток
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Остаток в норме
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Последнее движение
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {data.stats.lastMovementType
                  ? getMovementTypeLabel(data.stats.lastMovementType)
                  : "Нет движений"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {data.stats.lastMovementAt
                  ? formatDateTime(data.stats.lastMovementAt)
                  : "—"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Создан
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(data.product.createdAt)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {data.product.createdBy
                  ? `${data.product.createdBy.name} (@${data.product.createdBy.username})`
                  : "—"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Обновлён
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(data.product.updatedAt)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {data.product.updatedBy
                  ? `${data.product.updatedBy.name} (@${data.product.updatedBy.username})`
                  : "—"}
              </div>
            </div>
          </div>

          {data.product.isArchived ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Товар находится в архиве. Складские операции по нему запрещены до восстановления.
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Сводка по движениям
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Итоги по всей истории операций этого товара.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">Приход</span>
                <span className="font-semibold text-emerald-700">
                  +{formatNumber(data.stats.totalIn)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">Расход</span>
                <span className="font-semibold text-rose-700">
                  -{formatNumber(data.stats.totalOut)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">
                  Дельта корректировок
                </span>
                <span
                  className={`font-semibold ${
                    data.stats.adjustmentDelta >= 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {data.stats.adjustmentDelta >= 0 ? "+" : ""}
                  {formatNumber(data.stats.adjustmentDelta)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
                <span className="text-sm text-white/80">Чистое изменение</span>
                <span className="font-semibold text-white">
                  {data.stats.netChange >= 0 ? "+" : ""}
                  {formatNumber(data.stats.netChange)}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Чистое изменение считается только по истории движений и не
              обязательно равно текущему остатку, если товар был создан уже с
              начальным количеством.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <TrendingDown className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Быстрые переходы
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Полезные разделы для дальнейшей работы с товаром.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Все товары
              </Link>

              <Link
                href="/movements"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Все движения
              </Link>

              <Link
                href="/reports"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Отчёты
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <History className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Последние движения товара
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Последние операции прихода, расхода и корректировок по этой позиции.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {data.recentMovements.length > 0 ? (
            data.recentMovements.map((item) => (
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
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMovementTypeBadgeClass(
                        item.type
                      )}`}
                    >
                      {getMovementTypeLabel(item.type)}
                    </span>

                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {getMovementSourceLabel(item.source)}
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
              title="Движений пока нет"
              description="Для этого товара ещё не было операций склада."
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Shield className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Аудит по товару
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Последние audit-записи, связанные с этой сущностью Product.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {data.auditLogs.length > 0 ? (
            data.auditLogs.map((item) => (
              <AuditLogCard key={item.id} item={item} />
            ))
          ) : (
            <EmptyState
              title="Записи аудита не найдены"
              description="Для этого товара пока нет записей в журнале аудита."
            />
          )}
        </div>
      </div>

      <ProductQuickMovementDialog
        open={isQuickMovementOpen}
        currentUserRole={currentUserRole}
        product={{
          id: data.product.id,
          name: data.product.name,
          barcode: data.product.barcode,
          quantity: data.product.quantity,
          isArchived: data.product.isArchived,
        }}
        onClose={() => setIsQuickMovementOpen(false)}
        onSuccess={syncAfterMovement}
      />
    </section>
  );
}