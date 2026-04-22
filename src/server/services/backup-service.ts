import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const BACKUP_VERSION = "1.0";

const backupUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  name: z.string().min(1),
  passwordHash: z.string().min(1),
  role: z.enum(["ADMIN", "USER"]),
  isActive: z.boolean(),
  avatarUrl: z.string().nullable().optional().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const backupProductSchema = z.object({
  id: z.string().min(1),
  barcode: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int(),
  isArchived: z.boolean().optional().default(false),
  createdById: z.string().nullable().optional().default(null),
  updatedById: z.string().nullable().optional().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const backupStockMovementSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  performedById: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  source: z.enum(["MANUAL", "SCAN", "EXCEL_IMPORT", "ADMIN_EDIT"]),
  quantity: z.number().int().nonnegative(),
  balanceBefore: z.number().int(),
  balanceAfter: z.number().int(),
  note: z.string().nullable().optional().default(null),
  createdAt: z.string().min(1),
});

const backupAuditLogSchema = z.object({
  id: z.string().min(1),
  userId: z.string().nullable().optional().default(null),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().nullable().optional().default(null),
  details: z.unknown().nullable().optional().default(null),
  createdAt: z.string().min(1),
});

const backupSnapshotSchema = z.object({
  meta: z.object({
    app: z.string().min(1),
    version: z.string().min(1),
    exportedAt: z.string().min(1),
    exportedBy: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        username: z.string().min(1),
      })
      .nullable(),
  }),
  data: z.object({
    users: z.array(backupUserSchema),
    products: z.array(backupProductSchema),
    stockMovements: z.array(backupStockMovementSchema),
    auditLogs: z.array(backupAuditLogSchema),
  }),
});

type BackupSnapshot = z.infer<typeof backupSnapshotSchema>;

type BackupActor = {
  id: string;
  name: string;
  username: string;
};

function parseDate(value: string, fieldName: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Некорректная дата в поле ${fieldName}`);
  }

  return date;
}

function ensureUnique(value: string, set: Set<string>, label: string) {
  if (set.has(value)) {
    throw new Error(`В backup найдены дубликаты: ${label}`);
  }

  set.add(value);
}

function validateSnapshot(snapshot: BackupSnapshot) {
  if (snapshot.meta.version !== BACKUP_VERSION) {
    throw new Error(
      `Неподдерживаемая версия backup: ${snapshot.meta.version}. Ожидается ${BACKUP_VERSION}`
    );
  }

  if (snapshot.data.users.length === 0) {
    throw new Error("В backup нет пользователей");
  }

  const activeAdminsCount = snapshot.data.users.filter(
    (user) => user.role === "ADMIN" && user.isActive
  ).length;

  if (activeAdminsCount === 0) {
    throw new Error("В backup должен быть хотя бы один активный администратор");
  }

  const userIds = new Set<string>();
  const usernames = new Set<string>();
  const productIds = new Set<string>();
  const barcodes = new Set<string>();
  const movementIds = new Set<string>();
  const auditLogIds = new Set<string>();

  for (const user of snapshot.data.users) {
    ensureUnique(user.id, userIds, `users.id = ${user.id}`);
    ensureUnique(
      user.username.toLowerCase(),
      usernames,
      `users.username = ${user.username}`
    );

    parseDate(user.createdAt, `users.createdAt (${user.id})`);
    parseDate(user.updatedAt, `users.updatedAt (${user.id})`);
  }

  for (const product of snapshot.data.products) {
    ensureUnique(product.id, productIds, `products.id = ${product.id}`);
    ensureUnique(
      product.barcode,
      barcodes,
      `products.barcode = ${product.barcode}`
    );

    if (product.createdById && !userIds.has(product.createdById)) {
      throw new Error(
        `Товар ${product.id} ссылается на отсутствующий createdById: ${product.createdById}`
      );
    }

    if (product.updatedById && !userIds.has(product.updatedById)) {
      throw new Error(
        `Товар ${product.id} ссылается на отсутствующий updatedById: ${product.updatedById}`
      );
    }

    parseDate(product.createdAt, `products.createdAt (${product.id})`);
    parseDate(product.updatedAt, `products.updatedAt (${product.id})`);
  }

  for (const movement of snapshot.data.stockMovements) {
    ensureUnique(movement.id, movementIds, `stockMovements.id = ${movement.id}`);

    if (!productIds.has(movement.productId)) {
      throw new Error(
        `Движение ${movement.id} ссылается на отсутствующий productId: ${movement.productId}`
      );
    }

    if (!userIds.has(movement.performedById)) {
      throw new Error(
        `Движение ${movement.id} ссылается на отсутствующий performedById: ${movement.performedById}`
      );
    }

    parseDate(movement.createdAt, `stockMovements.createdAt (${movement.id})`);
  }

  for (const log of snapshot.data.auditLogs) {
    ensureUnique(log.id, auditLogIds, `auditLogs.id = ${log.id}`);

    if (log.userId && !userIds.has(log.userId)) {
      throw new Error(
        `Аудит ${log.id} ссылается на отсутствующий userId: ${log.userId}`
      );
    }

    parseDate(log.createdAt, `auditLogs.createdAt (${log.id})`);
  }
}

export async function buildWarehouseBackupSnapshot(actor: BackupActor) {
  const [users, products, stockMovements, auditLogs] = await Promise.all([
    prisma.user.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        username: true,
        name: true,
        passwordHash: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.product.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        barcode: true,
        name: true,
        quantity: true,
        isArchived: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.stockMovement.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        productId: true,
        performedById: true,
        type: true,
        source: true,
        quantity: true,
        balanceBefore: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        details: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    meta: {
      app: "SvetRost",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: actor.id,
        name: actor.name,
        username: actor.username,
      },
    },
    data: {
      users: users.map((user) => ({
        ...user,
        avatarUrl: user.avatarUrl ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      products: products.map((product) => ({
        ...product,
        isArchived: product.isArchived ?? false,
        createdById: product.createdById ?? null,
        updatedById: product.updatedById ?? null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      })),
      stockMovements: stockMovements.map((movement) => ({
        ...movement,
        note: movement.note ?? null,
        createdAt: movement.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => ({
        ...log,
        userId: log.userId ?? null,
        entityId: log.entityId ?? null,
        details: log.details ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
    },
  };
}

export async function restoreWarehouseBackupSnapshot(
  input: unknown,
  actor: BackupActor
) {
  const snapshot = backupSnapshotSchema.parse(input);

  validateSnapshot(snapshot);

  const summary = {
    users: snapshot.data.users.length,
    products: snapshot.data.products.length,
    stockMovements: snapshot.data.stockMovements.length,
    auditLogs: snapshot.data.auditLogs.length + 1,
  };

  const actorExistsInBackup = snapshot.data.users.some(
    (user) => user.id === actor.id
  );

  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.product.deleteMany();
    await tx.user.deleteMany();

    if (snapshot.data.users.length > 0) {
      await tx.user.createMany({
        data: snapshot.data.users.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          passwordHash: user.passwordHash,
          role: user.role,
          isActive: user.isActive,
          avatarUrl: user.avatarUrl ?? null,
          createdAt: parseDate(user.createdAt, `users.createdAt (${user.id})`),
          updatedAt: parseDate(user.updatedAt, `users.updatedAt (${user.id})`),
        })),
      });
    }

    if (snapshot.data.products.length > 0) {
      await tx.product.createMany({
        data: snapshot.data.products.map((product) => ({
          id: product.id,
          barcode: product.barcode,
          name: product.name,
          quantity: product.quantity,
          isArchived: product.isArchived ?? false,
          ...(product.createdById ? { createdById: product.createdById } : {}),
          ...(product.updatedById ? { updatedById: product.updatedById } : {}),
          createdAt: parseDate(
            product.createdAt,
            `products.createdAt (${product.id})`
          ),
          updatedAt: parseDate(
            product.updatedAt,
            `products.updatedAt (${product.id})`
          ),
        })),
      });
    }

    if (snapshot.data.stockMovements.length > 0) {
      await tx.stockMovement.createMany({
        data: snapshot.data.stockMovements.map((movement) => ({
          id: movement.id,
          productId: movement.productId,
          performedById: movement.performedById,
          type: movement.type,
          source: movement.source,
          quantity: movement.quantity,
          balanceBefore: movement.balanceBefore,
          balanceAfter: movement.balanceAfter,
          note: movement.note ?? null,
          createdAt: parseDate(
            movement.createdAt,
            `stockMovements.createdAt (${movement.id})`
          ),
        })),
      });
    }

    for (const log of snapshot.data.auditLogs) {
      await tx.auditLog.create({
        data: {
          id: log.id,
          ...(log.userId ? { userId: log.userId } : {}),
          action: log.action,
          entityType: log.entityType,
          ...(log.entityId ? { entityId: log.entityId } : {}),
          ...(log.details !== null && log.details !== undefined
            ? { details: log.details as Prisma.InputJsonValue }
            : {}),
          createdAt: parseDate(log.createdAt, `auditLogs.createdAt (${log.id})`),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        ...(actorExistsInBackup ? { userId: actor.id } : {}),
        action: "BACKUP_RESTORE",
        entityType: "System",
        details: {
          restoredAt: new Date().toISOString(),
          restoredBy: {
            id: actor.id,
            name: actor.name,
            username: actor.username,
          },
          backupVersion: snapshot.meta.version,
          restoredCounts: summary,
        } as Prisma.InputJsonValue,
      },
    });
  });

  return {
    summary,
    warnings: [
      "Локальные файлы аватаров не входят в backup-файл.",
      "После восстановления может потребоваться повторный вход в систему.",
      "Текущие данные были полностью заменены данными из резервной копии.",
    ],
  };
}