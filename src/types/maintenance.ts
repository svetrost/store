export type ProductStockMismatchItem = {
  productId: string;
  name: string;
  barcode: string;
  isArchived: boolean;
  currentQuantity: number;
  expectedQuantity: number;
  difference: number;
  lastMovementId: string | null;
  lastMovementAt: string | null;
};

export type StockConsistencyReport = {
  checkedAt: string;
  totals: {
    productsTotal: number;
    productsWithMovements: number;
    productsWithoutMovements: number;
    archivedProducts: number;
    consistentProducts: number;
    mismatchedProducts: number;
  };
  mismatches: ProductStockMismatchItem[];
};

export type StockCheckApiResponse =
  | {
      success: true;
      report: StockConsistencyReport;
    }
  | {
      success: false;
      message: string;
    };

export type RecalculateStockApiResponse =
  | {
      success: true;
      message: string;
      summary: {
        updatedProducts: number;
        unchangedProducts: number;
        mismatchedBefore: number;
      };
      report: StockConsistencyReport;
    }
  | {
      success: false;
      message: string;
    };