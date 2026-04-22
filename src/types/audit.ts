import type { Prisma } from "@prisma/client";

export type AuditActorRole =
  Prisma.UserGetPayload<{ select: { role: true } }>["role"];

export type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    role: AuditActorRole;
  } | null;
};

export type AuditLogFilters = {
  search: string;
  action: string;
  entityType: string;
  actorRole: "" | AuditActorRole;
  dateFrom: string;
  dateTo: string;
  limit: number;
};

export type AuditLogStats = {
  totalLogs: number;
  uniqueActors: number;
  adminActions: number;
  criticalActions: number;
  entityTypesCount: number;
};

export type AuditLogOptions = {
  actions: string[];
  entityTypes: string[];
};

export type AuditLogListPayload = {
  filters: AuditLogFilters;
  stats: AuditLogStats;
  options: AuditLogOptions;
  logs: AuditLogItem[];
};

export type AuditLogListApiResponse =
  | {
      success: true;
      data: AuditLogListPayload;
    }
  | {
      success: false;
      message: string;
    };