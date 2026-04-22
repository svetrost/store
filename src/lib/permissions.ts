import type { Prisma } from "@prisma/client";

export type Role = Prisma.UserGetPayload<{ select: { role: true } }>["role"];

export type MenuVisibility = "ALL" | "ADMIN" | "SUPERADMIN";

export function isAdminLike(role: Role | null | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function isSuperAdmin(role: Role | null | undefined) {
  return role === "SUPERADMIN";
}

export function canSeeMenuItem(
  role: Role | null | undefined,
  visibility: MenuVisibility
) {
  if (visibility === "ALL") {
    return true;
  }

  if (visibility === "ADMIN") {
    return isAdminLike(role);
  }

  return isSuperAdmin(role);
}

export function canManageTargetUser(params: {
  actorRole: Role;
  targetRole: Role;
}) {
  const { actorRole, targetRole } = params;

  if (actorRole === "SUPERADMIN") {
    return true;
  }

  if (actorRole === "ADMIN") {
    return targetRole !== "SUPERADMIN";
  }

  return false;
}

export function canAssignRole(params: {
  actorRole: Role;
  targetCurrentRole: Role;
  nextRole: Role;
}) {
  const { actorRole, targetCurrentRole, nextRole } = params;

  if (actorRole === "SUPERADMIN") {
    return true;
  }

  if (actorRole === "ADMIN") {
    if (targetCurrentRole === "SUPERADMIN") {
      return false;
    }

    if (nextRole === "SUPERADMIN") {
      return false;
    }

    return true;
  }

  return false;
}

export function getAssignableRoles(actorRole: Role): Role[] {
  if (actorRole === "SUPERADMIN") {
    return ["USER", "ADMIN", "SUPERADMIN"];
  }

  if (actorRole === "ADMIN") {
    return ["USER", "ADMIN"];
  }

  return ["USER"];
}