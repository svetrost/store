import type { AppRole } from "@/types/auth";

export function isAdmin(role?: AppRole | null): boolean {
  return role === "ADMIN";
}

export function canViewDashboard(role?: AppRole | null): boolean {
  return role === "ADMIN" || role === "USER";
}

export function canViewProducts(role?: AppRole | null): boolean {
  return role === "ADMIN" || role === "USER";
}

export function canCreateMovement(role?: AppRole | null): boolean {
  return role === "ADMIN" || role === "USER";
}

export function canManageUsers(role?: AppRole | null): boolean {
  return role === "ADMIN";
}

export function canEditProducts(role?: AppRole | null): boolean {
  return role === "ADMIN";
}

export function canGenerateBarcode(role?: AppRole | null): boolean {
  return role === "ADMIN";
}

export function canImportExcel(role?: AppRole | null): boolean {
  return role === "ADMIN";
}

export function canExportExcel(role?: AppRole | null): boolean {
  return role === "ADMIN" || role === "USER";
}