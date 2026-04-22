export type ManagedUserRole = "SUPERADMIN" | "ADMIN" | "USER";

export type ManagedUserItem = {
  id: string;
  name: string;
  username: string;
  role: ManagedUserRole;
  createdAt: string;
  updatedAt: string;
};

export type UsersManagementOverview = {
  totalUsers: number;
  superAdmins: number;
  admins: number;
  users: number;
};

export type UsersManagementData = {
  overview: UsersManagementOverview;
  users: ManagedUserItem[];
};

export type UsersManagementApiResponse =
  | {
      success: true;
      data: UsersManagementData;
    }
  | {
      success: false;
      message: string;
    };

export type UserCreateApiResponse =
  | {
      success: true;
      message: string;
      user: ManagedUserItem;
    }
  | {
      success: false;
      message: string;
    };

export type UserRoleUpdateApiResponse =
  | {
      success: true;
      message: string;
      user: {
        id: string;
        role: ManagedUserRole;
        updatedAt: string;
      };
    }
  | {
      success: false;
      message: string;
    };