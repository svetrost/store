import { requireAdmin } from "@/lib/auth";
import { UsersManager } from "@/components/users/users-manager";
import { getUsersManagementData } from "@/server/services/user-management-service";

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const initialData = await getUsersManagementData();

  return (
    <UsersManager
      initialData={initialData}
      currentUserId={currentUser.id}
    />
  );
}