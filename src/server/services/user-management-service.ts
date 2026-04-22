import { UserRole as PrismaRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canAssignRole,
  canManageTargetUser,
  getAssignableRoles,
  isAdminLike,
} from "@/lib/permissions";

type Role = Prisma.UserGetPayload<{ select: { role: true } }>["role"];

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Имя слишком короткое")
    .max(100, "Имя слишком длинное"),
  username: z
    .string()
    .trim()
    .min(3, "Логин слишком короткий")
    .max(50, "Логин слишком длинный")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Логин может содержать только буквы, цифры, ., _, -"
    ),
  password: z
    .string()
    .min(6, "Пароль должен содержать минимум 6 символов")
    .max(100, "Пароль слишком длинный"),
  role: z.nativeEnum(PrismaRole).default(PrismaRole.USER),
});

const updateUserRoleSchema = z.object({
  role: z.nativeEnum(PrismaRole),
});

type UserManagementActor = {
  id: string;
  name: string;
  username: string;
  role: Role;
};

const ROLE_SORT_ORDER: Record<Role, number> = {
  SUPERADMIN: 0,
  ADMIN: 1,
  USER: 2,
};

function normalizeId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Не указан идентификатор пользователя");
  }

  return normalized;
}

function assertUserManagementAccess(actor: UserManagementActor) {
  if (!isAdminLike(actor.role)) {
    throw new Error("Недостаточно прав");
  }
}

function sortUsers<T extends { role: Role; updatedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.role !== b.role) {
      return ROLE_SORT_ORDER[a.role] - ROLE_SORT_ORDER[b.role];
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function buildOverview(items: { role: Role }[]) {
  const superAdmins = items.filter((item) => item.role === "SUPERADMIN").length;
  const admins = items.filter(
    (item) => item.role === "ADMIN" || item.role === "SUPERADMIN"
  ).length;
  const users = items.filter((item) => item.role === "USER").length;

  return {
    totalUsers: items.length,
    admins,
    superAdmins,
    users,
  };
}

export async function getUsersManagementData() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const normalizedUsers = sortUsers(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }))
  );

  return {
    overview: buildOverview(normalizedUsers),
    users: normalizedUsers,
  };
}

export async function createUserByAdmin(
  input: unknown,
  actor: UserManagementActor
) {
  assertUserManagementAccess(actor);

  const parsed = createUserSchema.parse(input);

  const name = parsed.name.trim();
  const username = parsed.username.trim();
  const password = parsed.password;
  const role = parsed.role;

  if (!getAssignableRoles(actor.role).includes(role)) {
    throw new Error("Недостаточно прав для назначения этой роли");
  }

  return await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findFirst({
      where: {
        username,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new Error("Пользователь с таким логином уже существует");
    }

    const hashedPassword = await hash(password, 10);

    const createdUser = await tx.user.create({
      data: {
        name,
        username,
        role,
        // Если в твоей модели поле называется password, а не passwordHash,
        // замени строку ниже на: password: hashedPassword,
        passwordHash: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "USER_CREATED_BY_ADMIN",
        entityType: "User",
        entityId: createdUser.id,
        details: {
          userId: createdUser.id,
          name: createdUser.name,
          username: createdUser.username,
          role: createdUser.role,
          createdBy: {
            id: actor.id,
            name: actor.name,
            username: actor.username,
            role: actor.role,
          },
          createdAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message:
        role === "SUPERADMIN"
          ? "Пользователь успешно создан с ролью SUPERADMIN"
          : "Пользователь успешно создан",
      user: {
        id: createdUser.id,
        name: createdUser.name,
        username: createdUser.username,
        role: createdUser.role,
        createdAt: createdUser.createdAt.toISOString(),
        updatedAt: createdUser.updatedAt.toISOString(),
      },
    };
  });
}

export async function updateUserRole(
  userId: string,
  input: unknown,
  actor: UserManagementActor
) {
  assertUserManagementAccess(actor);

  const normalizedUserId = normalizeId(userId);
  const parsed = updateUserRoleSchema.parse(input);

  return await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: {
        id: normalizedUserId,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
    });

    if (!targetUser) {
      throw new Error("Пользователь не найден");
    }

    if (targetUser.id === actor.id) {
      throw new Error("Нельзя менять роль самому себе");
    }

    if (targetUser.role === parsed.role) {
      throw new Error("У пользователя уже установлена эта роль");
    }

    if (
      !canManageTargetUser({
        actorRole: actor.role,
        targetRole: targetUser.role,
      })
    ) {
      throw new Error("Недостаточно прав для управления этим пользователем");
    }

    if (
      !canAssignRole({
        actorRole: actor.role,
        targetCurrentRole: targetUser.role,
        nextRole: parsed.role,
      })
    ) {
      throw new Error("Недостаточно прав для изменения роли");
    }

    if (targetUser.role === "SUPERADMIN" && parsed.role !== "SUPERADMIN") {
      const superAdminsCount = await tx.user.count({
        where: {
          role: "SUPERADMIN",
        },
      });

      if (superAdminsCount <= 1) {
        throw new Error("Нельзя понизить последнего SUPERADMIN");
      }
    }

    const updatedUser = await tx.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        role: parsed.role,
      },
      select: {
        id: true,
        role: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: targetUser.id,
        details: {
          userId: targetUser.id,
          name: targetUser.name,
          username: targetUser.username,
          previousRole: targetUser.role,
          nextRole: parsed.role,
          changedBy: {
            id: actor.id,
            name: actor.name,
            username: actor.username,
            role: actor.role,
          },
          changedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message:
        parsed.role === "SUPERADMIN"
          ? "Пользователь назначен SUPERADMIN"
          : parsed.role === "ADMIN"
            ? "Пользователь назначен администратором"
            : "Пользователь переведён в роль USER",
      user: {
        id: updatedUser.id,
        role: updatedUser.role,
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
    };
  });
}