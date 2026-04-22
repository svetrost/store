"use client";

import { useState } from "react";
import { Archive, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { ProductArchiveApiResponse } from "@/types/product-archive";

type ProductArchiveToggleButtonProps = {
  productId: string;
  isArchived: boolean;
  canManage: boolean;
  className?: string;
  onSuccess?: (product: {
    id: string;
    isArchived: boolean;
    updatedAt: string;
  }) => Promise<void> | void;
};

export function ProductArchiveToggleButton({
  productId,
  isArchived,
  canManage,
  className,
  onSuccess,
}: ProductArchiveToggleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!canManage) {
    return null;
  }

  async function handleClick() {
    const confirmed = window.confirm(
      isArchived
        ? "Восстановить товар из архива?"
        : "Отправить товар в архив? Складские операции по нему будут запрещены."
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/products/${productId}/archive`, {
        method: isArchived ? "DELETE" : "POST",
      });

      const data = (await response.json()) as ProductArchiveApiResponse;

      if (!response.ok || !data.success) {
        toast.error(
          data.success === false
            ? data.message
            : "Не удалось изменить статус товара"
        );
        return;
      }

      toast.success(data.message);
      await onSuccess?.(data.product);
    } catch {
      toast.error("Ошибка сети или сервера");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isLoading}
      className={
        className ??
        "inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Сохранение...
        </>
      ) : isArchived ? (
        <>
          <RotateCcw className="mr-2 h-4 w-4" />
          Восстановить
        </>
      ) : (
        <>
          <Archive className="mr-2 h-4 w-4" />
          В архив
        </>
      )}
    </button>
  );
}