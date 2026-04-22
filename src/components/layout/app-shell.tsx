"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ClipboardList,
  Database,
  Download,
  Home,
  Package2,
  Shield,
  UserCircle2,
  Users,
  Wrench,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { type MenuVisibility, canSeeMenuItem } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type ShellUserRole = "USER" | "ADMIN" | "SUPERADMIN";

type ShellUser = {
  id: string;
  name: string;
  username: string;
  role: ShellUserRole;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  visibility: MenuVisibility;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Дашборд",
    icon: Home,
    visibility: "ALL",
  },
  {
    href: "/products",
    label: "Товары",
    icon: Package2,
    visibility: "ALL",
  },
  {
    href: "/movements",
    label: "Движение",
    icon: ArrowLeftRight,
    visibility: "ALL",
  },
  {
    href: "/users",
    label: "Пользователи",
    icon: Users,
    visibility: "ADMIN",
  },
  {
    href: "/inventory",
    label: "Инвентаризация",
    icon: ClipboardList,
    visibility: "ADMIN",
  },
  {
    href: "/maintenance",
    label: "Сервис",
    icon: Wrench,
    visibility: "SUPERADMIN",
  },
  {
    href: "/exports",
    label: "Экспорт",
    icon: Download,
    visibility: "SUPERADMIN",
  },
  {
    href: "/backups",
    label: "Резерв",
    icon: Database,
    visibility: "SUPERADMIN",
  },
  {
    href: "/audit",
    label: "Аудит",
    icon: Shield,
    visibility: "SUPERADMIN",
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: UserCircle2,
    visibility: "ALL",
  },
];

const ROLE_META: Record<
  ShellUserRole,
  {
    label: string;
    className: string;
  }
> = {
  USER: {
    label: "Пользователь",
    className: "bg-blue-100 text-blue-800",
  },
  ADMIN: {
    label: "Администратор",
    className: "bg-amber-100 text-amber-800",
  },
  SUPERADMIN: {
    label: "Суперадмин",
    className: "bg-rose-100 text-rose-800",
  },
};

function getNavigation(role: ShellUser["role"]): NavItem[] {
  return NAV_ITEMS.filter((item) => canSeeMenuItem(role, item.visibility));
}

function getCurrentPageTitle(pathname: string, role: ShellUser["role"]) {
  const visibleItems = getNavigation(role);

  const visibleItem = visibleItems.find(
    (navItem) =>
      pathname === navItem.href || pathname.startsWith(`${navItem.href}/`)
  );

  if (visibleItem) {
    return visibleItem.label;
  }

  const anyItem = NAV_ITEMS.find(
    (navItem) =>
      pathname === navItem.href || pathname.startsWith(`${navItem.href}/`)
  );

  return anyItem?.label ?? "Склад SvetRost";
}

function getMobileNavigationGridClass(itemsCount: number) {
  if (itemsCount <= 4) {
    return "grid-cols-4";
  }

  if (itemsCount === 5) {
    return "grid-cols-5";
  }

  return "grid-cols-3";
}

type AppShellProps = {
  user: ShellUser;
  children: ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const navigation = getNavigation(user.role);
  const currentPageTitle = getCurrentPageTitle(pathname, user.role);
  const roleMeta = ROLE_META[user.role];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="border-b border-slate-200 p-6">
            <div className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
              Складская система
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              SvetRost
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Учёт товаров, движения, пользователи, аудит и отчёты.
            </p>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="mb-4 rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">
                {user.name}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                @{user.username}
              </div>
              <div
                className={cn(
                  "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                  roleMeta.className
                )}
              >
                {roleMeta.label}
              </div>
            </div>

            <LogoutButton />
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Склад SvetRost
                </div>
                <h2 className="truncate text-lg font-bold text-slate-900 md:text-2xl">
                  {currentPageTitle}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "hidden rounded-full px-3 py-1 text-xs font-semibold md:inline-flex",
                    roleMeta.className
                  )}
                >
                  {roleMeta.label}
                </div>

                <div className="hidden md:block">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </header>

          <main
            className={cn(
              "flex-1 px-4 py-5 md:px-8 md:py-8 md:pb-8",
              navigation.length > 5 ? "pb-40" : "pb-24"
            )}
          >
            {children}
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
            <div
              className={cn(
                "grid gap-1 px-2 py-2",
                getMobileNavigationGridClass(navigation.length)
              )}
            >
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium transition",
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="mb-1 h-5 w-5" />
                    <span className="text-center leading-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}