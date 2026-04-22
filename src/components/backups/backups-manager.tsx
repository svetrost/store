"use client";

import { useRef, useState } from "react";
import {
  Database,
  Download,
  Loader2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { formatNumber } from "@/lib/format";
import type {
  BackupErrorApiResponse,
  BackupOverview,
  RestoreBackupApiResponse,
} from "@/types/backup";

type BackupsManagerProps = {
  initialOverview: BackupOverview;
};

export function BackupsManager({
  initialOverview,
}: BackupsManagerProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExport() {
    setErrorText("");
    setSuccessText("");
    setWarnings([]);
    setIsExporting(true);

    try {
      const response = await fetch("/api/backups/export", {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as BackupErrorApiResponse;
        setErrorText(errorData.message ?? "Не удалось создать backup");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      const contentDisposition =
        response.headers.get("content-disposition") ?? "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const fileName =
        fileNameMatch?.[1] ?? `svetrost-backup-${Date.now()}.json`;

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Резервная копия успешно скачана");
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleRestore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");
    setWarnings([]);

    if (!restoreFile) {
      setErrorText("Выбери backup-файл");
      return;
    }

    if (confirmText.trim() !== "ВОССТАНОВИТЬ") {
      setErrorText('Для подтверждения введи слово "ВОССТАНОВИТЬ"');
      return;
    }

    setIsRestoring(true);

    try {
      const formData = new FormData();
      formData.append("file", restoreFile);

      const response = await fetch("/api/backups/restore", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as RestoreBackupApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось восстановить данные"
        );
        return;
      }

      setOverview(data.summary);
      setSuccessText(data.message);
      setWarnings(data.warnings);
      setRestoreFile(null);
      setConfirmText("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast.success("Восстановление завершено");
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Резервные копии"
        description="Экспорт и восстановление основных данных системы. Раздел доступен только администратору."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Пользователи</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.users)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Товары</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.products)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Движения</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.stockMovements)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Записи аудита</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.auditLogs)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Download className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Экспорт backup
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Скачивает JSON-файл с пользователями, товарами, движениями и журналом аудита.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Рекомендуется делать экспорт перед крупными изменениями,
            импортом Excel и обновлениями системы.
          </div>

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Подготовка...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Скачать резервную копию
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <TriangleAlert className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Восстановление из backup
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Это действие полностью заменит текущие данные данными из выбранного файла.
              </p>
            </div>
          </div>

          <form onSubmit={handleRestore} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Backup-файл
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(event) =>
                  setRestoreFile(event.target.files?.[0] ?? null)
                }
                className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
              />
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Перед восстановлением убедись, что у тебя есть актуальная резервная копия текущего состояния.
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Подтверждение
              </label>
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder='Введи: ВОССТАНОВИТЬ'
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              />
            </div>

            <button
              type="submit"
              disabled={isRestoring}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Восстановление...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Восстановить данные
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Database className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Важные замечания
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Перед использованием восстановления внимательно прочитай ограничения.
            </p>
          </div>
        </div>

        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>В backup входят только данные базы, а не физические файлы из public/uploads.</li>
          <li>После восстановления активная сессия может потребовать повторного входа.</li>
          <li>Восстановление полностью заменяет текущие данные, а не объединяет их.</li>
          <li>Используй только backup-файл, созданный этой системой.</li>
        </ul>
      </div>

      {errorText ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {errorText}
        </div>
      ) : null}

      {successText ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
          {successText}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="text-sm font-semibold text-amber-900">
            Предупреждения после восстановления
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-800">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}