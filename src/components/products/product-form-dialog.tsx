"use client";

import type { ProductCategory } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { ProductApiResponse, ProductListItem } from "@/types/product";
import { getProductCategoryByValue } from "@/lib/product-categories";

type ProductFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  category: ProductCategory;
  product?: ProductListItem | null;
  onClose: () => void;
  onSuccess: (product: ProductListItem) => void;
};

export function ProductFormDialog({
  open,
  mode,
  category,
  product,
  onClose,
  onSuccess,
}: ProductFormDialogProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [note, setNote] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCategory = useMemo(
    () => getProductCategoryByValue(category),
    [category]
  );

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && product) {
      setName(product.name);
      setQuantity(String(product.quantity));
      setNote("");
    } else {
      setName("");
      setQuantity("0");
      setNote("");
    }

    setErrorText("");
  }, [open, mode, product]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");

    const trimmedName = name.trim();
    const parsedQuantity = Number(quantity);
    const trimmedNote = note.trim();

    if (!trimmedName) {
      setErrorText("Укажи название товара");
      return;
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      setErrorText("Количество должно быть целым числом не меньше 0");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: trimmedName,
        quantity: parsedQuantity,
        note: trimmedNote,
        category,
      };

      const response = await fetch(
        mode === "create" ? "/api/products" : `/api/products/${product?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json()) as ProductApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false ? data.message : "Не удалось сохранить товар"
        );
        return;
      }

      onSuccess(data.product);
      toast.success(
        mode === "create"
          ? "Товар успешно создан"
          : "Товар успешно обновлён"
      );
      onClose();
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "create" ? "Добавить товар" : "Редактировать товар"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {mode === "create"
                ? "Новый штрих-код будет сгенерирован автоматически."
                : "Изменение количества будет записано как корректировка остатка."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Категория:{" "}
            <span className="font-medium text-slate-900">
              {currentCategory?.label ?? category}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Название товара
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Например: Лампа LED 12W"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Количество
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Комментарий
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder={
                mode === "create"
                  ? "Например: начальный остаток при создании"
                  : "Например: пересчёт остатков на складе"
              }
              disabled={isSubmitting}
            />
          </div>

          {mode === "edit" && product ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Текущий штрих-код:{" "}
              <span className="font-medium">{product.barcode}</span>
            </div>
          ) : null}

          {errorText ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorText}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={isSubmitting}
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : mode === "create" ? (
                "Создать товар"
              ) : (
                "Сохранить изменения"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}