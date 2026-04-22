import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      success: true,
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "degraded",
        database: "error",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        responseTimeMs: Date.now() - startedAt,
        message:
          error instanceof Error ? error.message : "База данных недоступна",
      },
      { status: 503 }
    );
  }
}