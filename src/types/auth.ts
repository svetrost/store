export type AppRole = "ADMIN" | "USER";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: AppRole;
};