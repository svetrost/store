import path from "path";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const MIME_TO_EXTENSION = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export async function saveAvatarFile(file: File, userId: string) {
  if (!MIME_TO_EXTENSION.has(file.type)) {
    throw new Error("Разрешены только JPG, PNG и WEBP");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Размер аватара не должен превышать 2 МБ");
  }

  await mkdir(AVATAR_DIR, { recursive: true });

  const extension = MIME_TO_EXTENSION.get(file.type);

  if (!extension) {
    throw new Error("Неподдерживаемый формат файла");
  }

  const fileName = `${userId}-${randomUUID()}${extension}`;
  const absolutePath = path.join(AVATAR_DIR, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, buffer);

  return `/uploads/avatars/${fileName}`;
}

export async function deleteAvatarFileIfLocal(avatarUrl?: string | null) {
  if (!avatarUrl) {
    return;
  }

  if (!avatarUrl.startsWith("/uploads/avatars/")) {
    return;
  }

  const relativePath = avatarUrl.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  try {
    await unlink(absolutePath);
  } catch {
    // ignore
  }
}