import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";

function getStartOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const todayStart = getStartOfToday();

  const [productCount, quantityAggregate, recentMovements, todayMovements] =
    await Promise.all([
      prisma.product.count({
        where: { isArchived: false },
      }),
      prisma.product.aggregate({
        _sum: {
          quantity: true,
        },
        where: {
          isArchived: false,
        },
      }),
      prisma.stockMovement.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              name: true,
              barcode: true,
            },
          },
          performedBy: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.stockMovement.findMany({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
        select: {
          type: true,
          quantity: true,
        },
      }),
    ]);

  const todayIn = todayMovements
    .filter((item) => item.type === "IN")
    .reduce((sum, item) => sum + item.quantity, 0);

  const todayOut = todayMovements
    .filter((item) => item.type === "OUT")
    .reduce((sum, item) => sum + item.quantity, 0);

  const totalQuantity = quantityAggregate._sum.quantity ?? 0;

  const statCards = [
    {
      title: "Всего товаров",
      value: formatNumber(productCount),
      hint: "Активные позиции на складе",
    },
    {
      title: "Общий остаток",
      value: formatNumber(totalQuantity),
      hint: "Суммарное количество единиц",
    },
    {
      title: "Приход сегодня",
      value: formatNumber(todayIn),
      hint: "Сумма входящих операций",
    },
    {
      title: "Расход сегодня",
      value: formatNumber(todayOut),
      hint: "Сумма исходящих операций",
    },
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        title="Дашборд"
        description="Общая статистика по складу, быстрые переходы и последние движения товаров."
        actions={
          <>
            <Link
              href="/products"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Открыть товары
            </Link>
            <Link
              href="/movements"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Перейти к движению
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="text-sm font-medium text-slate-500">
              {card.title}
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {card.value}
            </div>
            <div className="mt-2 text-sm text-slate-600">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Последние операции
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Последние зарегистрированные действия по товарам.
              </p>
            </div>

            <Link
              href="/movements"
              className="text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              Все движения
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentMovements.length > 0 ? (
              recentMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {movement.product.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Штрих-код: {movement.product.barcode}
                      </div>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        movement.type === "IN"
                          ? "bg-emerald-100 text-emerald-700"
                          : movement.type === "OUT"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {movement.type === "IN"
                        ? `Приход +${movement.quantity}`
                        : movement.type === "OUT"
                        ? `Расход -${movement.quantity}`
                        : `Корректировка ${movement.quantity}`}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                    <span>Пользователь: {movement.performedBy.name}</span>
                    <span>{formatDateTime(movement.createdAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                Пока нет операций. В следующих блоках подключим приход/расход,
                сканирование и журнал движений.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Быстрые действия
            </h2>
            <div className="mt-4 grid gap-3">
              <Link
                href="/products"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Просмотр товаров и остатков
              </Link>
              <Link
                href="/movements"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Зарегистрировать движение товара
              </Link>
              <Link
                href="/profile"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Открыть личный кабинет
              </Link>
              {user.role === "ADMIN" ? (
                <Link
                  href="/users"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Управление пользователями
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Роль и доступ
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Вы вошли как{" "}
              <span className="font-semibold text-slate-900">{user.name}</span>.
            </p>
            <div
              className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                user.role === "ADMIN"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {user.role === "ADMIN" ? "Администратор" : "Пользователь"}
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {user.role === "ADMIN"
                ? "Администратор может управлять товарами, пользователями, импортом/экспортом Excel и журналом действий."
                : "Обычный пользователь может просматривать остатки и регистрировать приход/расход товара."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}