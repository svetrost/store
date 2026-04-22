"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  ManagedUserItem,
  ManagedUserRole,
  UserCreateApiResponse,
  UserRoleUpdateApiResponse,
  UsersManagementApiResponse,
  UsersManagementData,
} from "@/types/user-management";

type UsersManagerProps = {
  initialData: UsersManagementData;
  currentUserId: string;
};

type RoleFilter = "all" | ManagedUserRole;
type AssignableRole = Extract<ManagedUserRole, "ADMIN" | "USER">;

const roleOrder: Record<ManagedUserRole, number> = {
  SUPERADMIN: 0,
  ADMIN: 1,
  USER: 2,
};

function sortUsers(items: ManagedUserItem[]) {
  return [...items].sort((a, b) => {
    if (a.role !== b.role) {
      return roleOrder[a.role] - roleOrder[b.role];
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function getRoleBadgeClass(role: ManagedUserRole) {
  if (role === "SUPERADMIN") {
    return "bg-rose-100 text-rose-800";
  }

  if (role === "ADMIN") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}

function getRoleIconWrapClass(role: ManagedUserRole) {
  if (role === "SUPERADMIN") {
    return "bg-rose-100 text-rose-700";
  }

  if (role === "ADMIN") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getRoleLabel(role: ManagedUserRole) {
  return role;
}

function getRoleAction(user: ManagedUserItem): {
  nextRole: AssignableRole;
  label: string;
} | null {
  if (user.role === "SUPERADMIN") {
    return null;
  }

  if (user.role === "ADMIN") {
    return {
      nextRole: "USER",
      label: "Сделать USER",
    };
  }

  return {
    nextRole: "ADMIN",
    label: "Сделать ADMIN",
  };
}

export function UsersManager({
  initialData,
  currentUserId,
}: UsersManagerProps) {
  const [users, setUsers] = useState(() => sortUsers(initialData.users));
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [errorText, setErrorText] = useState("");
  const [createErrorText, setCreateErrorText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<AssignableRole>("USER");

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.username.toLowerCase().includes(normalizedQuery);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesQuery && matchesRole;
    });
  }, [users, query, roleFilter]);

  const overview = useMemo(() => {
    const superAdmins = users.filter(
      (user) => user.role === "SUPERADMIN"
    ).length;
    const admins = users.filter((user) => user.role === "ADMIN").length;
    const regularUsers = users.filter((user) => user.role === "USER").length;

    return {
      totalUsers: users.length,
      superAdmins,
      admins,
      users: regularUsers,
      found: filteredUsers.length,
    };
  }, [filteredUsers.length, users]);

  async function loadUsers(showToast: boolean) {
    setErrorText("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/users");
      const data = (await response.json()) as UsersManagementApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось загрузить пользователей"
        );
        return;
      }

      setUsers(sortUsers(data.data.users));

      if (showToast) {
        toast.success("Список пользователей обновлён");
      }
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCreateErrorText("");

    if (!createName.trim()) {
      setCreateErrorText("Укажи имя пользователя");
      return;
    }

    if (!createUsername.trim()) {
      setCreateErrorText("Укажи логин пользователя");
      return;
    }

    if (!createPassword.trim()) {
      setCreateErrorText("Укажи пароль");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createName,
          username: createUsername,
          password: createPassword,
          role: createRole,
        }),
      });

      const data = (await response.json()) as UserCreateApiResponse;

      if (!response.ok || !data.success) {
        setCreateErrorText(
          data.success === false
            ? data.message
            : "Не удалось создать пользователя"
        );
        return;
      }

      setUsers((previous) => sortUsers([data.user, ...previous]));
      setCreateName("");
      setCreateUsername("");
      setCreatePassword("");
      setCreateRole("USER");

      toast.success(data.message);
    } catch {
      setCreateErrorText("Ошибка сети или сервера");
    } finally {
      setIsCreating(false);
    }
  }

  async function changeRole(user: ManagedUserItem, nextRole: AssignableRole) {
    const confirmed = window.confirm(
      nextRole === "ADMIN"
        ? `Назначить пользователя ${user.name} администратором?`
        : `Перевести пользователя ${user.name} в роль USER?`
    );

    if (!confirmed) {
      return;
    }

    setErrorText("");
    setPendingUserId(user.id);

    try {
      const response = await fetch(`/api/users/${user.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: nextRole,
        }),
      });

      const data = (await response.json()) as UserRoleUpdateApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось изменить роль пользователя"
        );
        return;
      }

      setUsers((previous) =>
        sortUsers(
          previous.map((item) =>
            item.id === data.user.id
              ? {
                  ...item,
                  role: data.user.role,
                  updatedAt: data.user.updatedAt,
                }
              : item
          )
        )
      );

      toast.success(data.message);
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Пользователи"
        description="Создание пользователей, просмотр списка и управление ролями доступа."
        actions={
          <button
            type="button"
            onClick={() => void loadUsers(true)}
            disabled={isLoading}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Всего пользователей</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.totalUsers)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">SUPERADMIN</div>
          <div className="mt-3 text-3xl font-bold text-rose-800">
            {formatNumber(overview.superAdmins)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">ADMIN</div>
          <div className="mt-3 text-3xl font-bold text-amber-800">
            {formatNumber(overview.admins)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">USER</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.users)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Найдено по фильтру</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(overview.found)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <UserPlus className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Добавить пользователя
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Создание нового пользователя от имени администратора.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Имя
                </label>
                <input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Например: Иван Петров"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  value={createUsername}
                  onChange={(event) => setCreateUsername(event.target.value)}
                  placeholder="Например: ivan.petrov"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Пароль
                </label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  placeholder="Минимум 6 символов"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Роль
                </label>
                <select
                  value={createRole}
                  onChange={(event) =>
                    setCreateRole(event.target.value as AssignableRole)
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              {createErrorText ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {createErrorText}
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Роль SUPERADMIN с этого экрана не назначается.
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? "Создание..." : "Создать пользователя"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по имени или логину"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-11 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                  aria-label="Очистить поиск"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-4">
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as RoleFilter)
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="all">Все роли</option>
                <option value="SUPERADMIN">Только SUPERADMIN</option>
                <option value="ADMIN">Только ADMIN</option>
                <option value="USER">Только USER</option>
              </select>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Изменения ролей логируются в audit. Нельзя менять роль самому себе,
              нельзя понизить последнего администратора, а роль SUPERADMIN не
              меняется с этого экрана.
            </div>

            {errorText ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorText}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          {filteredUsers.length === 0 ? (
            <EmptyState
              title="Пользователи не найдены"
              description="Попробуй изменить строку поиска или фильтр по роли."
            />
          ) : (
            <>
              <div className="grid gap-4 md:hidden">
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const isPending = pendingUserId === user.id;
                  const roleAction = getRoleAction(user);

                  return (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-slate-900">
                              {user.name}
                            </div>

                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(
                                user.role
                              )}`}
                            >
                              {getRoleLabel(user.role)}
                            </span>

                            {isCurrentUser ? (
                              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                Это вы
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 text-sm text-slate-600">
                            @{user.username}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <div>
                          Создан:{" "}
                          <span className="font-medium text-slate-900">
                            {formatDateTime(user.createdAt)}
                          </span>
                        </div>
                        <div>
                          Обновлён:{" "}
                          <span className="font-medium text-slate-900">
                            {formatDateTime(user.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        {isCurrentUser ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Свою роль менять нельзя.
                          </div>
                        ) : !roleAction ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Роль SUPERADMIN нельзя менять с этого экрана.
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void changeRole(user, roleAction.nextRole)}
                            disabled={isPending}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPending ? "Сохранение..." : roleAction.label}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Пользователь</th>
                        <th className="px-4 py-3 font-medium">Роль</th>
                        <th className="px-4 py-3 font-medium">Создан</th>
                        <th className="px-4 py-3 font-medium">Обновлён</th>
                        <th className="px-4 py-3 font-medium">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const isCurrentUser = user.id === currentUserId;
                        const isPending = pendingUserId === user.id;
                        const roleAction = getRoleAction(user);

                        return (
                          <tr key={user.id} className="border-t border-slate-200">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${getRoleIconWrapClass(
                                    user.role
                                  )}`}
                                >
                                  {user.role === "USER" ? (
                                    <User className="h-4 w-4" />
                                  ) : (
                                    <Shield className="h-4 w-4" />
                                  )}
                                </div>

                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium text-slate-900">
                                      {user.name}
                                    </div>

                                    {isCurrentUser ? (
                                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                        Это вы
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="text-slate-600">
                                    @{user.username}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(
                                  user.role
                                )}`}
                              >
                                {getRoleLabel(user.role)}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {formatDateTime(user.createdAt)}
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {formatDateTime(user.updatedAt)}
                            </td>

                            <td className="px-4 py-3">
                              {isCurrentUser ? (
                                <div className="text-sm text-slate-500">
                                  Свою роль менять нельзя
                                </div>
                              ) : !roleAction ? (
                                <div className="text-sm text-slate-500">
                                  SUPERADMIN нельзя менять с этого экрана
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void changeRole(user, roleAction.nextRole)}
                                  disabled={isPending}
                                  className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isPending ? "Сохранение..." : roleAction.label}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Users className="h-5 w-5" />
          </div>

        
        </div>
      </div>
    </section>
  );
}