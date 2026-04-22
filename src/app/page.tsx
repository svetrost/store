import Link from "next/link";

export default function HomePage() {
  const steps = [
    "Блок 1: Инициализация проекта",
    "Блок 2: База данных",
    "Блок 3: Авторизация и роли",
    "Блок 4: Layout и 5 вкладок",
    "Блок 5: Товары",
    "Блок 6: Движение товаров",
    "Блок 7: Сканер штрих-кода",
    "Блок 8: Excel импорт/экспорт",
    "Блок 9: Пользователи и личный кабинет",
    "Блок 10: Docker и запуск",
  ];

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6">
          <p className="mb-2 inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
            Проект инициализирован
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Склад SvetRost
          </h1>
          <p className="mt-3 text-slate-600">
            Каркас проекта запущен. Авторизация и роли уже подключаются.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Войти в систему
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Открыть дашборд
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            План разработки
          </h2>
          <ol className="space-y-2 text-sm text-slate-700">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          После проверки этого шага напиши: <strong>давай следующий</strong>
        </div>
      </div>
    </main>
  );
}