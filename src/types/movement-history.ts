export type MovementFilterType = "all" | "IN" | "OUT" | "ADJUSTMENT";

export type MovementFilterSource =
  | "all"
  | "MANUAL"
  | "SCAN"
  | "EXCEL_IMPORT"
  | "ADMIN_EDIT";

export type MovementHistoryItem = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  source: "MANUAL" | "SCAN" | "EXCEL_IMPORT" | "ADMIN_EDIT";
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
  note: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    barcode: string;
    isArchived: boolean;
  };
  performedBy: {
    id: string;
    name: string;
    username: string;
  } | null;
};

export type MovementHistoryOverview = {
  totalMovements: number;
  productsCount: number;
  totalIn: number;
  totalOut: number;
  adjustmentDelta: number;
  netDelta: number;
};

export type MovementHistoryFilters = {
  search: string | null;
  type: MovementFilterType;
  source: MovementFilterSource;
  dateFrom: string | null;
  dateTo: string | null;
};

export type MovementHistoryData = {
  overview: MovementHistoryOverview;
  items: MovementHistoryItem[];
  filters: MovementHistoryFilters;
};

export type MovementHistoryApiResponse =
  | {
      success: true;
      data: MovementHistoryData;
    }
  | {
      success: false;
      message: string;
    };