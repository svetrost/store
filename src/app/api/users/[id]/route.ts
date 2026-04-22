import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUserSchema } from "@/lib/validators";
import type { UserRole } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serializeUser(user: {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { success: false, message: error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: false, message: "Ошибка сервера" }, { status: 500 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await context.params;
    const body = updateUserSchema.parse(await request.json());

    const user = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!existingUser) {
        throw new Error("Пользователь не найден");
      }

      const duplicateUser = await tx.user.findFirst({
        where: {
          username: body.username,
          id: {
            not: existingUser.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateUser) {
        throw new Error("Пользователь с таким логином уже существует");
      }

      if (
        existingUser.id === currentUser.id &&
        (!body.isActive || body.role !== existingUser.role)
      ) {
        throw new Error("Нельзя отключить себя или изменить собственную роль");
      }

      if (
        existingUser.role === "ADMIN" &&
        (body.role !== "ADMIN" || !body.isActive)
      ) {
        const otherActiveAdmins = await tx.user.count({
          where: {
            id: {
              not: existingUser.id,
            },
            role: "ADMIN",
            isActive: true,
          },
        });

        if (otherActiveAdmins === 0) {
          throw new Error("В системе должен остаться хотя бы один активный администратор");
        }
      }

      const updatedUser = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: body.name,
          username: body.username,
          role: body.role,
          isActive: body.isActive,
          ...(body.password
            ? {
                passwordHash: await hash(body.password, 10),
              }
            : {}),
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "USER_UPDATE",
          entityType: "User",
          entityId: updatedUser.id,
          details: {
            before: {
              username: existingUser.username,
              name: existingUser.name,
              role: existingUser.role,
              isActive: existingUser.isActive,
            },
            after: {
              username: updatedUser.username,
              name: updatedUser.name,
              role: updatedUser.role,
              isActive: updatedUser.isActive,
            },
            passwordChanged: Boolean(body.password),
          },
        },
      });

      return updatedUser;
    });

    return NextResponse.json({
      success: true,
      user: serializeUser(user),
    });
  } catch (error) {
    return handleError(error);
  }
}