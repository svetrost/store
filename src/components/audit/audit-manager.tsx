"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  AuditLogItem,
  AuditLogListApiResponse,
  AuditLogListPayload,
} from "@/types/audit";

type AuditManagerProps = {
  initialData: AuditLogListPayload;
};

type AuditActorRole = NonNullable<AuditLogItem["user"]>["role"];
type ActorRoleFilter = "" | AuditActorRole;

const ACTION_LABELS: Record<string, string> = {
  USER_CREATE: "Создание пользователя",
  USER_UPDATE: "Изменение пользователя",
  PRODUCT_CREATE: "Создание товара",
  PRODUCT_UPDATE: "Изменение товара",
  MOVEMENT_CREATE: "Создание движения",
  MOVEMENT_IMPORT: "Импорт движений",
  PROFILE_UPDATE: "Обновление профиля",
  PROFILE_PASSWORD_CHANGE: "Смена пароля",
  PROFILE_AVATAR_UPDATE: "Обновление аватара",
};

const ENTITY_LABELS: Record<string, string> = {
  User: "Пользователь",
  Product: "Товар",
  StockMovement: "Движение",
};

const CRITICAL_ACTIONS = new Set([
  "USER_CREATE",
  "USER_UPDATE",
  "PRODUCT_CREATE",
  "PRODUCT_UPDATE",
  "MOVEMENT_CREATE",
  "MOVEMENT_IMPORT",
  "PROFILE_PASSWORD_CHANGE",
]);

function formatAuditAction(action: string) {
  return (
    ACTION_LABELS[action] ??
    action
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ")
  );
}

function formatEntityType(entityType: string) {
  return ENTITY_LABELS[entityType] ?? entityType;
}

function stringifyDetails(details: unknown) {
  if (details === null || details === undefined) {
    return "Нет дополнительных данных";
  }

  const serialized = JSON.stringify(details, null, 2);
  return serialized || "Нет дополнительных данных";
}

function getActorRoleBadgeClass(role: AuditActorRole) {
  switch (role) {
    case "SUPERADMIN":
      return "bg-rose-100 text-rose-800";
    case "ADMIN":
      return "bg-amber-100 text-amber-800";
    case "USER":
      return "bg-blue-100 text-blue-800";
  }
}

function getActorRoleLabel(role: AuditActorRole) {
  switch (role) {
    case "SUPERADMIN":
      return "Суперадмин";
    case "ADMIN":
      return "Админ";
    case "USER":
      return "Пользователь";
  }
}

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatDateInputValue(date);
}

function AuditLogCard({ log }: { log: AuditLogItem }) {
  const isCritical = CRITICAL_ACTIONS.has(log.action);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {formatAuditAction(log.action)}
            </span>

            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatEntityType(log.entityType)}
            </span>

            {isCritical ? (
              <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                Критичное действие
              </span>
            ) : null}

            {log.user ? (
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getActorRoleBadgeClass(
                  log.user.role
                )}`}
              >
                {getActorRoleLabel(log.user.role)}
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Система
              </span>
            )}
          </div>

          <div className="text-base font-semibold text-slate-900">
            {log.user
              ? `${log.user.name} (@${log.user.username})`
              : "Системное событие"}
          </div>

          <div className="text-sm text-slate-600">
            ID сущности:{" "}
            <span className="font-medium text-slate-900">
              {log.entityId ?? "—"}
            </span>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          {formatDateTime(log.createdAt)}
        </div>
      </div>

      <details className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
          Показать details
        </summary>
        <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 text-xs text-slate-700">
          {stringifyDetails(log.details)}
        </pre>
      </details>
    </div>
  );
}

export function AuditManager({ initialData }: AuditManagerProps) {
  const [data, setData] = useState(initialData);

  const [search, setSearch] = useState(initialData.filters.search);
  const [action, setAction] = useState(initialData.filters.action);
  const [entityType, setEntityType] = useState(initialData.filters.entityType);
  const [actorRole, setActorRole] = useState<ActorRoleFilter>(
    initialData.filters.actorRole
  );
  const [dateFrom, setDateFrom] = useState(initialData.filters.dateFrom);
  const [dateTo, setDateTo] = useState(initialData.filters.dateTo);
  const [limit, setLimit] = useState(String(initialData.filters.limit));

  const [errorText, setErrorText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const activeFilters = useMemo(() => {
    const result: string[] = [];

    if (search.trim()) {
      result.push(`Поиск: ${search.trim()}`);
    }

    if (action) {
      result.push(`Действие: ${formatAuditAction(action)}`);
    }

    if (entityType) {
      result.push(`Сущность: ${formatEntityType(entityType)}`);
    }

    if (actorRole) {
      result.push(`Роль автора: ${getActorRoleLabel(actorRole)}`);
    }

    if (dateFrom || dateTo) {
      result.push(`Период: ${dateFrom || "—"} — ${dateTo || "—"}`);
    }

    result.push(`Лимит: ${limit}`);

    return result;
  }, [search, action, entityType, actorRole, dateFrom, dateTo, limit]);

  async function loadLogs(next?: {
    search?: string;
    action?: string;
    entityType?: string;
    actorRole?: ActorRoleFilter;
    dateFrom?: string;
    dateTo?: string;
    limit?: string;
  }) {
    const effectiveSearch = next?.search ?? search;
    const effectiveAction = next?.action ?? action;
    const effectiveEntityType = next?.entityType ?? entityType;
    const effectiveActorRole = next?.actorRole ?? actorRole;
    const effectiveDateFrom = next?.dateFrom ?? dateFrom;
    const effectiveDateTo = next?.dateTo ?? dateTo;
    const effectiveLimit = next?.limit ?? limit;

    setErrorText("");
    setIsLoading(true);

    try {
      const params = new URLSearchParams();

      if (effectiveSearch.trim()) {
        params.set("search", effectiveSearch.trim());
      }

      if (effectiveAction) {
        params.set("action", effectiveAction);
      }

      if (effectiveEntityType) {
        params.set("entityType", effectiveEntityType);
      }

      if (effectiveActorRole) {
        params.set("actorRole", effectiveActorRole);
      }

      if (effectiveDateFrom) {
        params.set("dateFrom", effectiveDateFrom);
      }

      if (effectiveDateTo) {
        params.set("dateTo", effectiveDateTo);
      }

      if (effectiveLimit.trim()) {
        params.set("limit", effectiveLimit.trim());
      }

      const response = await fetch(`/api/audit?${params.toString()}`);
      const responseData = (await response.json()) as AuditLogListApiResponse;

      if (!response.ok || !responseData.success) {
        setErrorText(
          responseData.success === false
            ? responseData.message
            : "Не удалось загрузить журнал аудита"
        );
        return;
      }

      setData(responseData.data);
      toast.success("Журнал аудита обновлён");
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(days: number) {
    const nextDateTo = formatDateInputValue(new Date());
    const nextDateFrom = createDateDaysAgo(days - 1);

    setDateFrom(nextDateFrom);
    setDateTo(nextDateTo);

    void loadLogs({
      search,
      action,
      entityType,
      actorRole,
      dateFrom: nextDateFrom,
      dateTo: nextDateTo,
      limit,
    });
  }

  function resetFilters() {
    setSearch("");
    setAction("");
    setEntityType("");
    setActorRole("");
    setDateFrom("");
    setDateTo("");
    setLimit("50");

    void loadLogs({
      search: "",
      action: "",
      entityType: "",
      actorRole: "",
      dateFrom: "",
      dateTo: "",
      limit: "50",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadLogs();
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Журнал аудита"
        description="История действий в системе: создание, изменение, импорт, профиль и другие важные события."
        actions={
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Найдено записей</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(data.stats.totalLogs)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Уникальных авторов</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(data.stats.uniqueActors)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Действий админов</div>
          <div className="mt-3 text-3xl font-bold text-amber-800">
            {formatNumber(data.stats.adminActions)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Критичных событий</div>
          <div className="mt-3 text-3xl font-bold text-rose-700">
            {formatNumber(data.stats.criticalActions)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Shield className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">Фильтры</h2>
            <p className="mt-1 text-sm text-slate-600">
              Можно искать по действию, сущности, ID, имени пользователя и логину.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Поиск
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Например: USER_UPDATE, Product, admin, username, entity id"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-11 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                    aria-label="Очистить поиск"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Действие
              </label>
              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Все действия</option>
                {data.options.actions.map((item) => (
                  <option key={item} value={item}>
                    {formatAuditAction(item)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Сущность
              </label>
              <select
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Все сущности</option>
                {data.options.entityTypes.map((item) => (
                  <option key={item} value={item}>
                    {formatEntityType(item)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Роль автора
              </label>
              <select
                value={actorRole}
                onChange={(event) =>
                  setActorRole(event.target.value as ActorRoleFilter)
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Все роли</option>
                <option value="SUPERADMIN">Суперадминистратор</option>
                <option value="ADMIN">Администратор</option>
                <option value="USER">Пользователь</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Дата от
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Дата до
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Лимит
              </label>
              <select
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset(1)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Сегодня
            </button>

            <button
              type="button"
              onClick={() => applyPreset(7)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              7 дней
            </button>

            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              30 дней
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Сбросить
            </button>
          </div>

          {errorText ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorText}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              "Применить фильтры"
            )}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {activeFilters.map((item) => (
            <div
              key={item}
              className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-slate-500">Типов сущностей</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {formatNumber(data.stats.entityTypesCount)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-slate-500">События админов</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {formatNumber(data.stats.adminActions)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-slate-500">Критичные действия</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {formatNumber(data.stats.criticalActions)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {data.logs.length === 0 ? (
        <EmptyState
          title="Записи не найдены"
          description="По текущим фильтрам журнал аудита пуст."
        />
      ) : (
        <div className="space-y-4">
          {data.logs.map((log) => (
            <AuditLogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </section>
  );
}