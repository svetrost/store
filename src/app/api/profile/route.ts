import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validators";

const profileUserSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type ProfileRouteUser = Prisma.UserGetPayload<{
  select: typeof profileUserSelect;
}>;

function serializeUser(user: ProfileRouteUser) {
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

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: error.issues[0]?.message ?? "Некорректные данные",
      },
      { status: 400 }
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

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireUser();
    const body = updateProfileSchema.parse(await request.json());

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          name: body.name,
        },
        select: profileUserSelect,
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "PROFILE_UPDATE",
          entityType: "User",
          entityId: currentUser.id,
          details: {
            name: updatedUser.name,
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