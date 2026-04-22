import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 inline-flex rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
          Доступ запрещён
        </p>
        <h1 className="text-2xl font-bold text-slate-900">
          Недостаточно прав доступа
        </h1>
        <p className="mt-3 text-slate-600">
          У вашей учётной записи нет прав для открытия этой страницы.
        </p>

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Вернуться в дашборд
          </Link>
        </div>
      </div>
    </main>
  );
}