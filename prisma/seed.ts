import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SEED_ADMIN_NAME?.trim();
  const username = process.env.SEED_ADMIN_USERNAME?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!name || !username || !password) {
    throw new Error(
      "Для seed администратора нужны переменные: SEED_ADMIN_NAME, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD"
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      username,
    },
    select: {
      id: true,
      username: true,
      role: true,
    },
  });

  if (existingUser) {
    console.log(
      `Пользователь ${existingUser.username} уже существует, seed пропущен`
    );
    return;
  }

  const passwordHash = await hash(password, 10);

  const createdUser = await prisma.user.create({
    data: {
      name,
      username,
      role: "ADMIN",
      // Если у тебя поле называется password, а не passwordHash,
      // замени строку ниже на: password: passwordHash,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  console.log("Первый администратор создан:");
  console.log({
    id: createdUser.id,
    username: createdUser.username,
    role: createdUser.role,
    createdAt: createdUser.createdAt.toISOString(),
  });
}

main()
  .catch((error) => {
    console.error("Ошибка seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });