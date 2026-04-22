"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type {
  ImportBatchListItem,
  ImportMovementsApiResponse,
} from "@/types/excel";

type ExcelImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onImported: (batch: ImportBatchListItem) => void;
};

export function ExcelImportDialog({
  open,
  onClose,
  onImported,
}: ExcelImportDialogProps) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setErrorText("Выбери Excel-файл для импорта");
      return;
    }

    setErrorText("");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/excel/import-movements", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ImportMovementsApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false ? data.message : "Не удалось выполнить импорт"
        );
        return;
      }

      onImported(data.batch);

      if (data.summary.rowsFailed > 0) {
        toast.warning(
          `Импорт завершён частично: успешно ${data.summary.rowsSuccess}, ошибок ${data.summary.rowsFailed}`
        );
      } else {
        toast.success(
          `Импорт завершён: успешно загружено ${data.summary.rowsSuccess} строк`
        );
      }

      setFile(null);
      onClose();
      router.refresh();
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Импорт движений из Excel
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Одна строка = одна операция прихода или расхода.
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>

              <div className="text-sm text-slate-700">
                <div className="font-semibold text-slate-900">
                  Формат файла
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>поддерживаются файлы `.xlsx` и `.xls`;</li>
                  <li>колонки: `barcode`, `type`, `quantity`, `note`;</li>
                  <li>тип движения: только `IN` или `OUT`;</li>
                  <li>для старта можно скачать готовый шаблон.</li>
                </ul>

                <div className="mt-3">
                  <a
                    href="/api/excel/template"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-teal-700 hover:text-teal-800"
                  >
                    Скачать шаблон Excel
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Excel-файл
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) =>
                setFile(event.target.files?.[0] ?? null)
              }
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
            />
          </div>

          {file ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Выбран файл: <span className="font-medium">{file.name}</span>
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
                  Импорт...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Загрузить файл
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}