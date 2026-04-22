import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];

  if (!username) {
    throw new Error("Передай username: tsx scripts/make-superadmin.ts <username>");
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
      username: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error(`Пользователь "${username}" не найден`);
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      role: "SUPERADMIN",
    },
  });

  console.log(`Пользователь ${username} назначен SUPERADMIN`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });