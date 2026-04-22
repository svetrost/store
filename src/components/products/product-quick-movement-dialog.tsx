"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";
import type {
  QuickProductMovementApiResponse,
  QuickProductMovementType,
} from "@/types/product-quick-movement";
import type { UserRole } from "@prisma/client";

type ProductQuickMovementDialogProps = {
  open: boolean;
  currentUserRole: UserRole;
  product: {
    id: string;
    name: string;
    barcode: string;
    quantity: number;
    isArchived: boolean;
  };
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
};

function getTypeLabel(type: QuickProductMovementType) {
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

function getSubmitLabel(type: QuickProductMovementType) {
  switch (type) {
    case "IN":
      return "Провести приход";
    case "OUT":
      return "Провести расход";
    case "ADJUSTMENT":
      return "Сохранить корректировку";
    default:
      return "Сохранить";
  }
}

export function ProductQuickMovementDialog({
  open,
  currentUserRole,
  product,
  onClose,
  onSuccess,
}: ProductQuickMovementDialogProps) {
  const canAdjust =
  currentUserRole === "SUPERADMIN" || currentUserRole === "ADMIN";
  const [type, setType] = useState<QuickProductMovementType>("IN");
  const [quantity, setQuantity] = useState("1");
  const [targetQuantity, setTargetQuantity] = useState(String(product.quantity));
  const [note, setNote] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setType("IN");
    setQuantity("1");
    setTargetQuantity(String(product.quantity));
    setNote("");
    setErrorText("");
    setIsSubmitting(false);
  }, [open, product.id, product.quantity]);

  const preview = useMemo(() => {
    const currentQuantity = product.quantity;

    if (type === "ADJUSTMENT") {
      const nextQuantity = Number(targetQuantity);

      if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
        return null;
      }

      return {
        before: currentQuantity,
        after: Math.floor(nextQuantity),
        delta: Math.floor(nextQuantity) - currentQuantity,
      };
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return null;
    }

    const normalizedQuantity = Math.floor(parsedQuantity);

    return {
      before: currentQuantity,
      after:
        type === "IN"
          ? currentQuantity + normalizedQuantity
          : currentQuantity - normalizedQuantity,
      delta: type === "IN" ? normalizedQuantity : -normalizedQuantity,
    };
  }, [product.quantity, quantity, targetQuantity, type]);

  if (!open) {
    return null;
  }

  async function handleSubmit() {
    setErrorText("");

    if (product.isArchived) {
      setErrorText("Операции по архивному товару запрещены");
      return;
    }

    let payload: Record<string, unknown>;

    if (type === "ADJUSTMENT") {
      if (!canAdjust) {
        setErrorText("Корректировка доступна только администратору");
        return;
      }

      const parsedTargetQuantity = Number(targetQuantity);

      if (
        !Number.isFinite(parsedTargetQuantity) ||
        parsedTargetQuantity < 0 ||
        !Number.isInteger(parsedTargetQuantity)
      ) {
        setErrorText("Укажи корректный целый остаток для корректировки");
        return;
      }

      payload = {
        type,
        targetQuantity: parsedTargetQuantity,
        note: note.trim() || null,
      };
    } else {
      const parsedQuantity = Number(quantity);

      if (
        !Number.isFinite(parsedQuantity) ||
        parsedQuantity <= 0 ||
        !Number.isInteger(parsedQuantity)
      ) {
        setErrorText("Укажи корректное положительное целое количество");
        return;
      }

      if (type === "OUT" && parsedQuantity > product.quantity) {
        setErrorText("Нельзя списать больше, чем есть в остатке");
        return;
      }

      payload = {
        type,
        quantity: parsedQuantity,
        note: note.trim() || null,
      };
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/products/${product.id}/quick-movement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as QuickProductMovementApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось выполнить операцию"
        );
        return;
      }

      toast.success(data.message);
      await onSuccess();
      onClose();
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Быстрая складская операция
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {product.name} · {product.barcode}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setType("IN")}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                type === "IN"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Приход
            </button>

            <button
              type="button"
              onClick={() => setType("OUT")}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                type === "OUT"
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Расход
            </button>

            <button
              type="button"
              onClick={() => {
                if (canAdjust) {
                  setType("ADJUSTMENT");
                }
              }}
              disabled={!canAdjust}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                type === "ADJUSTMENT"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Корректировка
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Текущий остаток
              </div>
              <div className="mt-2 text-3xl font-bold text-slate-900">
                {formatNumber(product.quantity)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Тип операции
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {getTypeLabel(type)}
              </div>
            </div>
          </div>

          {type === "ADJUSTMENT" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Новый остаток
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={targetQuantity}
                onChange={(event) => setTargetQuantity(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <p className="mt-2 text-sm text-slate-500">
                Для корректировки будет создано движение типа{" "}
                <code>ADJUSTMENT</code>.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Количество
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Комментарий
            </label>
            <textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Необязательно"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {preview ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">
                Предпросмотр результата
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Было
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {formatNumber(preview.before)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Изменение
                  </div>
                  <div
                    className={`mt-2 text-2xl font-bold ${
                      preview.delta >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {preview.delta >= 0 ? "+" : ""}
                    {formatNumber(preview.delta)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Станет
                  </div>
                  <div
                    className={`mt-2 text-2xl font-bold ${
                      preview.after < 0 ? "text-rose-700" : "text-slate-900"
                    }`}
                  >
                    {formatNumber(preview.after)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {type === "OUT" && Number(quantity) > product.quantity ? (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>Нельзя списать больше, чем есть в остатке.</div>
            </div>
          ) : null}

          {!canAdjust ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Корректировка остатка доступна только администратору. Обычный
                пользователь может делать только приход и расход.
              </div>
            </div>
          ) : null}

          {errorText ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorText}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              getSubmitLabel(type)
            )}
          </button>
        </div>
      </div>
    </div>
  );
}