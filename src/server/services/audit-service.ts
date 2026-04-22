import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditLogListPayload } from "@/types/audit"; // путь поправь

type Role = Prisma.UserGetPayload<{ select: { role: true } }>["role"];
type AuditActorRoleFilter = AuditLogListPayload["filters"]["actorRole"];

const CRITICAL_AUDIT_ACTIONS = [
  "USER_CREATE",
  "USER_UPDATE",
  "PRODUCT_CREATE",
  "PRODUCT_UPDATE",
  "MOVEMENT_CREATE",
  "MOVEMENT_IMPORT",
  "PROFILE_PASSWORD_CHANGE",
] as const;

type GetAuditLogListOptions = {
  search?: string | null;
  action?: string | null;
  entityType?: string | null;
  actorRole?: AuditActorRoleFilter | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
};

function cleanString(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function parseDateParam(value: string | null | undefined, endOfDay: boolean) {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Некорректный формат даты. Используй YYYY-MM-DD");
  }

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error("Не удалось разобрать дату");
  }

  return date;
}

function normalizeLimit(value?: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  const normalized = Math.floor(Number(value));

  if (normalized < 1) {
    return 1;
  }

  return Math.min(normalized, 200);
}

function serializeAuditLog(log: {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Prisma.JsonValue | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    username: string;
    role: Role;
  } | null;
}) {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    details: log.details,
    createdAt: log.createdAt.toISOString(),
    user: log.user,
  };
}

function buildAuditWhere(
  options: GetAuditLogListOptions
): Prisma.AuditLogWhereInput {
  const search = cleanString(options.search);
  const action = cleanString(options.action);
  const entityType = cleanString(options.entityType);
  const actorRole = options.actorRole || null;

  const dateFrom = parseDateParam(options.dateFrom, false);
  const dateTo = parseDateParam(options.dateTo, true);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("Дата начала не может быть больше даты окончания");
  }

  return {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actorRole
      ? {
          user: {
            is: {
              role: actorRole,
            },
          },
        }
      : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              action: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              entityType: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              entityId: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              user: {
                is: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              user: {
                is: {
                  username: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function getAuditLogList(
  options: GetAuditLogListOptions = {}
): Promise<AuditLogListPayload> {
  const limit = normalizeLimit(options.limit);
  const where = buildAuditWhere(options);

  const [
    logs,
    totalLogs,
    actionOptionsRows,
    entityTypeOptionsRows,
    distinctActorRows,
    adminActions,
    criticalActions,
    distinctFilteredEntityTypes,
  ] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.count({
      where,
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: {
        action: true,
      },
      orderBy: {
        action: "asc",
      },
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: {
        entityType: true,
      },
      orderBy: {
        entityType: "asc",
      },
    }),
    prisma.auditLog.findMany({
      where: {
        AND: [
          where,
          {
            userId: {
              not: null,
            },
          },
        ],
      },
      distinct: ["userId"],
      select: {
        userId: true,
      },
    }),
    prisma.auditLog.count({
      where: {
        AND: [
          where,
          {
            user: {
              is: {
                role: {
                  in: ["ADMIN", "SUPERADMIN"],
                },
              },
            },
          },
        ],
      },
    }),
    prisma.auditLog.count({
      where: {
        AND: [
          where,
          {
            action: {
              in: [...CRITICAL_AUDIT_ACTIONS],
            },
          },
        ],
      },
    }),
    prisma.auditLog.findMany({
      where,
      distinct: ["entityType"],
      select: {
        entityType: true,
      },
    }),
  ]);

  const actorRole: AuditLogListPayload["filters"]["actorRole"] =
    options.actorRole ?? "";

  return {
    filters: {
      search: cleanString(options.search) ?? "",
      action: cleanString(options.action) ?? "",
      entityType: cleanString(options.entityType) ?? "",
      actorRole,
      dateFrom: cleanString(options.dateFrom) ?? "",
      dateTo: cleanString(options.dateTo) ?? "",
      limit,
    },
    stats: {
      totalLogs,
      uniqueActors: distinctActorRows.length,
      adminActions,
      criticalActions,
      entityTypesCount: distinctFilteredEntityTypes.length,
    },
    options: {
      actions: actionOptionsRows.map((item) => item.action),
      entityTypes: entityTypeOptionsRows.map((item) => item.entityType),
    },
    logs: logs.map(serializeAuditLog),
  };
}