import type { UserRole } from "@prisma/client";

export type UserRoleValue = UserRole;

export type UserListItem = {
  id: string;
  username: string;
  name: string;
  role: UserRoleValue;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserApiResponse =
  | {
      success: true;
      user: UserListItem;
      message?: string;
    }
  | {
      success: false;
      message: string;
    };

export type UsersApiResponse =
  | {
      success: true;
      users: UserListItem[];
    }
  | {
      success: false;
      message: string;
    };

export type ProfileUser = {
  id: string;
  username: string;
  name: string;
  role: UserRoleValue;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileApiResponse =
  | {
      success: true;
      user: ProfileUser;
      message?: string;
    }
  | {
      success: false;
      message: string;
    };

export type ChangePasswordApiResponse =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

export type AuditLogListItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user: {
    name: string;
    username: string;
  } | null;
};