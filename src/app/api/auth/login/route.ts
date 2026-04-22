import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const normalizedUsername = body.username.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Неверный логин или пароль",
        },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(
      body.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Неверный логин или пароль",
        },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "AUTH_LOGIN",
          entityType: "User",
          entityId: user.id,
          details: {
            username: user.username,
          },
        },
      });
    } catch {
      // не валим вход из-за логов
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: error.issues[0]?.message ?? "Некорректные данные",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Ошибка сервера при входе",
      },
      { status: 500 }
    );
  }
}