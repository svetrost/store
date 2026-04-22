import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAssignRole,
  canManageTargetUser,
  isAdminLike,
} from "@/lib/permissions";

type Role = Prisma.UserGetPayload<{ select: { role: true } }>["role"];

export async function getTargetUserRoleOrThrow(userId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!targetUser) {
    throw new Error("Пользователь не найден");
  }

  return targetUser;
}

export async function assertCanManageUser(params: {
  actorRole: Role;
  targetUserId: string;
}) {
  const { actorRole, targetUserId } = params;

  if (!isAdminLike(actorRole)) {
    throw new Error("Недостаточно прав");
  }

  const targetUser = await getTargetUserRoleOrThrow(targetUserId);

  if (
    !canManageTargetUser({
      actorRole,
      targetRole: targetUser.role,
    })
  ) {
    throw new Error("Недостаточно прав для управления этим пользователем");
  }

  return targetUser;
}

export async function assertCanAssignUserRole(params: {
  actorRole: Role;
  targetUserId: string;
  nextRole: Role;
}) {
  const { actorRole, targetUserId, nextRole } = params;

  const targetUser = await assertCanManageUser({
    actorRole,
    targetUserId,
  });

  if (
    !canAssignRole({
      actorRole,
      targetCurrentRole: targetUser.role,
      nextRole,
    })
  ) {
    throw new Error("Недостаточно прав для изменения роли");
  }

  const isDemotingSuperAdmin =
    targetUser.role === "SUPERADMIN" && nextRole !== "SUPERADMIN";

  if (isDemotingSuperAdmin) {
    const superAdminCount = await prisma.user.count({
      where: {
        role: "SUPERADMIN",
      },
    });

    if (superAdminCount <= 1) {
      throw new Error("Нельзя понизить последнего SUPERADMIN");
    }
  }

  return targetUser;
}