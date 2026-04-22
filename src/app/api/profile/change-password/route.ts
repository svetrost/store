import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";

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

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser();
    const body = changePasswordSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: {
        id: currentUser.id,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const isCurrentPasswordValid = await compare(
      body.currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Текущий пароль указан неверно" },
        { status: 400 }
      );
    }

    const isSamePassword = await compare(body.newPassword, user.passwordHash);

    if (isSamePassword) {
      return NextResponse.json(
        { success: false, message: "Новый пароль должен отличаться от текущего" },
        { status: 400 }
      );
    }

    const newPasswordHash = await hash(body.newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          passwordHash: newPasswordHash,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "PROFILE_PASSWORD_CHANGE",
          entityType: "User",
          entityId: currentUser.id,
          details: {
            changedBySelf: true,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Пароль успешно изменён",
    });
  } catch (error) {
    return handleError(error);
  }
}