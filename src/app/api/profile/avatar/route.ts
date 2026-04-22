import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteAvatarFileIfLocal, saveAvatarFile } from "@/lib/avatar";

export const runtime = "nodejs";

const userSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type AvatarRouteUser = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

function serializeUser(user: AvatarRouteUser) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 401 }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 403 }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { success: false, message: "Ошибка сервера" },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Файл не был передан" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: currentUser.id,
      },
      select: userSelect,
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const newAvatarUrl = await saveAvatarFile(file, currentUser.id);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          avatarUrl: newAvatarUrl,
        },
        select: userSelect,
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "PROFILE_AVATAR_UPDATE",
          entityType: "User",
          entityId: currentUser.id,
          details: {
            avatarUrl: newAvatarUrl,
          },
        },
      });

      return user;
    });

    await deleteAvatarFileIfLocal(existingUser.avatarUrl);

    return NextResponse.json({
      success: true,
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    return handleError(error);
  }
}