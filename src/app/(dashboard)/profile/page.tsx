import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileManager } from "@/components/profile/profile-manager";

export default async function ProfilePage() {
  const currentUser = await requireUser();

  const user = await prisma.user.findUnique({
    where: {
      id: currentUser.id,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const auditLogs =
    currentUser.role === "ADMIN"
      ? await prisma.auditLog.findMany({
          take: 12,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            user: {
              select: {
                name: true,
                username: true,
              },
            },
          },
        })
      : [];

  return (
    <ProfileManager
      initialUser={{
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }}
      auditLogs={auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
      }))}
    />
  );
}