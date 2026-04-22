import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        message: "Пользователь не авторизован",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    user,
  });
}