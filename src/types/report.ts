import type { MovementHistoryItem } from "@/types/movement";

export type ReportTopProductItem = {
  productId: string;
  name: string;
  barcode: string;
  totalQuantity: number;
  movementsCount: number;
};

export type ReportLowStockProductItem = {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  updatedAt: string;
};

export type WarehouseReportSummary = {
  period: {
    dateFrom: string | null;
    dateTo: string | null;
    lowStockThreshold: number;
  };
  totals: {
    movementsCount: number;
    productsTouched: number;
    totalIn: number;
    totalOut: number;
    netChange: number;
    lowStockProducts: number;
  };
  topIncomingProducts: ReportTopProductItem[];
  topOutgoingProducts: ReportTopProductItem[];
  lowStockProducts: ReportLowStockProductItem[];
  recentMovements: MovementHistoryItem[];
};

export type ReportSummaryApiResponse =
  | {
      success: true;
      summary: WarehouseReportSummary;
    }
  | {
      success: false;
      message: string;
    };