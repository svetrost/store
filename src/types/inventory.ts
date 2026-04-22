export type InventoryProductOption = {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  isArchived: boolean;
  updatedAt: string;
};

export type InventoryApplyResultItem = {
  productId: string;
  name: string;
  barcode: string;
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
  movementId: string;
};

export type InventoryApplySummary = {
  totalSelected: number;
  adjusted: number;
  skipped: number;
  totalDelta: number;
};

export type InventoryApplyApiResponse =
  | {
      success: true;
      message: string;
      summary: InventoryApplySummary;
      results: InventoryApplyResultItem[];
    }
  | {
      success: false;
      message: string;
    };