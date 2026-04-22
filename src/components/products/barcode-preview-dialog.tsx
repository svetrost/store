"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import type { ProductApiResponse, ProductListItem } from "@/types/product";

type BarcodePreviewDialogProps = {
  open: boolean;
  product: ProductListItem | null;
  canManage: boolean;
  onClose: () => void;
  onProductUpdate: (product: ProductListItem) => void;
};

export function BarcodePreviewDialog({
  open,
  product,
  canManage,
  onClose,
  onProductUpdate,
}: BarcodePreviewDialogProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  useEffect(() => {
    if (open) {
      setCacheBuster(Date.now());
    }
  }, [open, product?.id, product?.barcode]);

  if (!open || !product) {
    return null;
  }

  const currentProduct = product;
  const barcodeUrl = `/api/products/${currentProduct.id}/barcode?v=${cacheBuster}`;

  async function handleRegenerate() {
    const confirmed = window.confirm(
      "Сгенерировать новый штрих-код для этого товара?"
    );

    if (!confirmed) {
      return;
    }

    setIsRegenerating(true);

    try {
      const response = await fetch(
        `/api/products/${currentProduct.id}/generate-barcode`,
        {
          method: "POST",
        }
      );

      const data = (await response.json()) as ProductApiResponse;

      if (!response.ok || !data.success) {
        toast.error(
          data.success === false
            ? data.message
            : "Не удалось сгенерировать новый штрих-код"
        );
        return;
      }

      onProductUpdate(data.product);
      setCacheBuster(Date.now());
      toast.success("Новый штрих-код успешно сгенерирован");
    } catch {
      toast.error("Ошибка сети или сервера");
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Штрих-код товара
            </h3>
            <p className="mt-1 text-sm text-slate-600">{currentProduct.name}</p>
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

        <div className="px-5 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm text-slate-600">Код товара:</div>
            <div className="rounded-xl bg-white p-3 text-center text-lg font-semibold tracking-wide text-slate-900">
              {currentProduct.barcode}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
              <img
                src={barcodeUrl}
                alt={`Штрих-код ${currentProduct.barcode}`}
                className="mx-auto block max-h-[220px] w-full object-contain"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={barcodeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Открыть PNG
            </a>

            {canManage ? (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Новый штрих-код
                  </>
                )}
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Для печати можно открыть PNG в новой вкладке и распечатать через
            браузер.
          </div>
        </div>
      </div>
    </div>
  );
}