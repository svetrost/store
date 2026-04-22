import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "svetrost_session";

type AppRole = "USER" | "ADMIN" | "SUPERADMIN";

type ProxyPayload = {
  sub: string;
  username: string;
  name: string;
  role: AppRole;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET не задан");
  }

  return new TextEncoder().encode(secret);
}

function isValidRole(value: unknown): value is AppRole {
  return (
    value === "USER" || value === "ADMIN" || value === "SUPERADMIN"
  );
}

function isAdminLike(role: AppRole) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

function isSuperAdmin(role: AppRole) {
  return role === "SUPERADMIN";
}

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

async function verifyToken(token: string): Promise<ProxyPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.name !== "string" ||
      !isValidRole(payload.role)
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      username: payload.username,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyToken(token);

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  const adminRoutes = ["/users", "/inventory"];
  const superAdminRoutes = ["/maintenance", "/exports", "/backups", "/audit"];

  if (superAdminRoutes.some((route) => matchesRoute(pathname, route))) {
    if (!isSuperAdmin(payload.role)) {
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
  }

  if (adminRoutes.some((route) => matchesRoute(pathname, route))) {
    if (!isAdminLike(payload.role)) {
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/products/:path*",
    "/movements/:path*",
    "/users/:path*",
    "/inventory/:path*",
    "/maintenance/:path*",
    "/exports/:path*",
    "/backups/:path*",
    "/audit/:path*",
    "/profile/:path*",
  ],
};