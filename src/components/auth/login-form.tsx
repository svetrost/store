"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LoginResponse =
  | {
      success: true;
      user: {
        id: string;
        username: string;
        name: string;
        role: "ADMIN" | "USER";
      };
    }
  | {
      success: false;
      message: string;
    };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = searchParams.get("next") || "/dashboard";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = (await response.json()) as LoginResponse;

      if (!response.ok || !data.success) {
        setErrorText(
          data.success === false ? data.message : "Ошибка входа в систему"
        );
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setErrorText("Не удалось выполнить вход. Проверь подключение к серверу.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6">
        <p className="mb-2 inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
          Авторизация
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Склад SvetRost</h1>
        <p className="mt-2 text-sm text-slate-600">
          Войди в систему под своей учётной записью.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Логин
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="Введите логин"
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="Введите пароль"
            required
          />
        </div>

        {errorText ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorText}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Вход..." : "Войти"}
        </button>
      </form>

    </div>
  );
}