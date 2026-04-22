import { UserRole } from "@prisma/client";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "svetrost_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 дней

export class UnauthorizedError extends Error {
  constructor(message = "Необходим вход в систему") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Недостаточно прав") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type SessionPayload = JWTPayload & {
  sub: string;
  username: string;
  name: string;
  role: UserRole;
};

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      "Не задан NEXTAUTH_SECRET в .env. Укажи секрет для подписи сессии."
    );
  }

  return new TextEncoder().encode(secret);
}

function isValidUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    Object.values(UserRole).includes(value as UserRole)
  );
}

function isAdminLike(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
}

function isSuperAdmin(role: UserRole) {
  return role === UserRole.SUPERADMIN;
}

export async function createSessionToken(user: {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}): Promise<string> {
  const secretKey = getJwtSecretKey();

  return await new SignJWT({
    username: user.username,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey);

    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.name !== "string" ||
      !isValidUserRole(payload.role)
    ) {
      return null;
    }

    return {
      ...payload,
      sub: payload.sub,
      username: payload.username,
      name: payload.name,
      role: payload.role,
    } as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();

  if (!session?.sub) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (!isAdminLike(user.role)) {
    throw new ForbiddenError();
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();

  if (!isSuperAdmin(user.role)) {
    throw new ForbiddenError();
  }

  return user;
}