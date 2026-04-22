"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { UserApiResponse, UserListItem } from "@/types/user";

type UserFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  user?: UserListItem | null;
  onClose: () => void;
  onSuccess: (user: UserListItem) => void;
};

type FormUserRole = UserListItem["role"];

export function UserFormDialog({
  open,
  mode,
  user,
  onClose,
  onSuccess,
}: UserFormDialogProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<FormUserRole>("USER");
  const [isActive, setIsActive] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && user) {
      setName(user.name);
      setUsername(user.username);
      setPassword("");
      setRole(user.role);
      setIsActive(user.isActive);
    } else {
      setName("");
      setUsername("");
      setPassword("");
      setRole("USER");
      setIsActive(true);
    }

    setErrorText("");
  }, [open, mode, user]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create" ? "/api/users" : `/api/users/${user?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            username,
            password,
            role,
            isActive,
          }),
        }
      );

      const data = (await response.json()) as UserApiResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false
            ? data.message
            : "Не удалось сохранить пользователя"
        );
        return;
      }

      onSuccess(data.user);
      toast.success(
        mode === "create"
          ? "Пользователь успешно создан"
          : "Пользователь успешно обновлён"
      );
      onClose();
    } catch {
      setErrorText("Ошибка сети или сервера");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "create"
                ? "Новый пользователь"
                : "Редактирование пользователя"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {mode === "create"
                ? "Создай учётную запись и выбери роль."
                : "Можно изменить имя, логин, роль, активность и пароль."}
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Имя
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Например: Иван Петров"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Логин
            </label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Например: ivan.petrov"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {mode === "create" ? "Пароль" : "Новый пароль"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder={
                mode === "create"
                  ? "Введите пароль"
                  : "Оставь пустым, если менять не нужно"
              }
              required={mode === "create"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Роль
              </label>
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as FormUserRole)
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="USER">Пользователь</option>
                <option value="ADMIN">Администратор</option>
                <option value="SUPERADMIN">Суперадминистратор</option>
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-slate-700">
                Активный пользователь
              </span>
            </label>
          </div>

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
                  Сохранение...
                </>
              ) : mode === "create" ? (
                "Создать пользователя"
              ) : (
                "Сохранить изменения"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}