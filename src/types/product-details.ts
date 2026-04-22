import type { UserRole } from "@prisma/client";

export type ProductDetailsActor = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};

export type ProductMovementItem = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  source: "MANUAL" | "SCAN" | "EXCEL_IMPORT" | "ADMIN_EDIT";
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    barcode: string;
  };
  performedBy: {
    id: string;
    name: string;
    username: string;
  };
};

export type ProductAuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown | null;
  createdAt: string;
  user: ProductDetailsActor | null;
};

export type ProductDetailsData = {
  product: {
    id: string;
    barcode: string;
    name: string;
    quantity: number;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: ProductDetailsActor | null;
    updatedBy: ProductDetailsActor | null;
  };
  stats: {
    movementsCount: number;
    totalIn: number;
    totalOut: number;
    adjustmentDelta: number;
    netChange: number;
    lastMovementAt: string | null;
    lastMovementType: ProductMovementItem["type"] | null;
    lowStock: boolean;
  };
  recentMovements: ProductMovementItem[];
  auditLogs: ProductAuditLogItem[];
};

export type ProductDetailsApiResponse =
  | {
      success: true;
      data: ProductDetailsData;
    }
  | {
      success: false;
      message: string;
    };