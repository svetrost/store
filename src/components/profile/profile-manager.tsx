"use client";

import { useMemo, useState } from "react";
import { Camera, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { formatDateTime } from "@/lib/format";
import type {
  AuditLogListItem,
  ChangePasswordApiResponse,
  ProfileApiResponse,
  ProfileUser,
} from "@/types/user";

type ProfileManagerProps = {
  initialUser: ProfileUser;
  auditLogs: AuditLogListItem[];
};

export function ProfileManager({
  initialUser,
  auditLogs,
}: ProfileManagerProps) {
  const [user, setUser] = useState<ProfileUser>(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(Date.now());

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [avatarError, setAvatarError] = useState("");

  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isAvatarSubmitting, setIsAvatarSubmitting] = useState(false);

  const avatarSrc = useMemo(() => {
    if (!user.avatarUrl) {
      return null;
    }

    return `${user.avatarUrl}?v=${avatarVersion}`;
  }, [user.avatarUrl, avatarVersion]);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setIsProfileSubmitting(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      });

      const data = (await response.json()) as ProfileApiResponse;

      if (!response.ok || !data.success) {
        setProfileError(
          data.success === false ? data.message : "Не удалось сохранить профиль"
        );
        return;
      }

      setUser(data.user);
      setName(data.user.name);
      toast.success("Профиль успешно обновлён");
    } catch {
      setProfileError("Ошибка сети или сервера");
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  async function handleAvatarUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!avatarFile) {
      setAvatarError("Выбери изображение");
      return;
    }

    setAvatarError("");
    setIsAvatarSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", avatarFile);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ProfileApiResponse;

      if (!response.ok || !data.success) {
        setAvatarError(
          data.success === false ? data.message : "Не удалось загрузить аватар"
        );
        return;
      }

      setUser(data.user);
      setAvatarFile(null);
      setAvatarVersion(Date.now());
      toast.success("Аватар успешно обновлён");
    } catch {
      setAvatarError("Ошибка сети или сервера");
    } finally {
      setIsAvatarSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordError("Новый пароль и подтверждение не совпадают");
      return;
    }

    setPasswordError("");
    setIsPasswordSubmitting(true);

    try {
      const response = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = (await response.json()) as ChangePasswordApiResponse;

      if (!response.ok || !data.success) {
        setPasswordError(
          data.success === false ? data.message : "Не удалось изменить пароль"
        );
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(data.message);
    } catch {
      setPasswordError("Ошибка сети или сервера");
    } finally {
      setIsPasswordSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Личный кабинет"
        description="Управляй своим профилем, меняй пароль и загружай аватар."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Профиль</h2>

            <div className="mt-5 flex items-center gap-4">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={user.name}
                  className="h-20 w-20 rounded-3xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-200 text-2xl font-bold text-slate-700">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div>
                <div className="text-base font-semibold text-slate-900">
                  {user.name}
                </div>
                <div className="mt-1 text-sm text-slate-600">@{user.username}</div>
                <div
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    user.role === "ADMIN"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {user.role === "ADMIN" ? "Администратор" : "Пользователь"}
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="mt-6 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Имя
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Логин
                </label>
                <input
                  value={user.username}
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 text-slate-500"
                />
              </div>

              {profileError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {profileError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isProfileSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProfileSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить профиль
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Аватар</h2>

            <form onSubmit={handleAvatarUpload} className="mt-5 space-y-3">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Разрешены JPG, PNG, WEBP. Максимум 2 МБ.
              </div>

              {avatarError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {avatarError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isAvatarSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAvatarSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Загрузить аватар
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Смена пароля</h2>

            <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Текущий пароль"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Новый пароль"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите новый пароль"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />

              {passwordError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {passwordError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPasswordSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPasswordSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Изменить пароль"
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {user.role === "ADMIN" ? "Журнал действий" : "Информация"}
          </h2>

          {user.role === "ADMIN" ? (
            auditLogs.length > 0 ? (
              <div className="mt-5 space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {log.action}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Сущность: {log.entityType}
                          {log.entityId ? ` / ${log.entityId}` : ""}
                        </div>
                      </div>

                      <div className="text-sm text-slate-500">
                        {formatDateTime(log.createdAt)}
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-slate-600">
                      Пользователь:{" "}
                      {log.user ? `${log.user.name} (@${log.user.username})` : "Система"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Журнал пока пуст"
                description="Записи аудита появятся здесь автоматически."
              />
            )
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
              <div>
                Текущая учётная запись активна и готова к работе.
              </div>
              <div className="mt-3">
                Последнее обновление профиля: {formatDateTime(user.updatedAt)}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}