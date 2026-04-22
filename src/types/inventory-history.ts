import type { UserRole } from "@prisma/client";

export type InventoryHistoryUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
};

export type InventoryHistoryResultItem = {
  productId: string;
  name: string;
  barcode: string;
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
  movementId: string;
};

export type InventoryHistorySession = {
  id: string;
  sessionId: string;
  createdAt: string;
  user: InventoryHistoryUser | null;
  summary: {
    totalSelected: number;
    adjusted: number;
    skipped: number;
    totalDelta: number;
  };
  results: InventoryHistoryResultItem[];
  hasDetailedResults: boolean;
};

export type InventoryHistoryOverview = {
  sessions: number;
  adjusted: number;
  skipped: number;
  totalDelta: number;
};

export type InventoryHistoryData = {
  overview: InventoryHistoryOverview;
  sessions: InventoryHistorySession[];
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
  };
};

export type InventoryHistoryApiResponse =
  | {
      success: true;
      data: InventoryHistoryData;
    }
  | {
      success: false;
      message: string;
    };