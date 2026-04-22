export type ExportOverview = {
  products: number;
  stockMovements: number;
  lowStockProducts: number;
  auditLogs: number;
};

export type ExportUserRole = "ADMIN" | "USER";

export type ExportErrorApiResponse = {
  success: false;
  message: string;
};