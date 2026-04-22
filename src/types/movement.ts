export type MovementTypeValue = "IN" | "OUT" | "ADJUSTMENT";
export type MovementSourceValue =
  | "MANUAL"
  | "SCAN"
  | "EXCEL_IMPORT"
  | "ADMIN_EDIT";

export type MovementHistoryItem = {
  id: string;
  type: MovementTypeValue;
  source: MovementSourceValue;
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

export type MovementApiResponse =
  | {
      success: true;
      movement: MovementHistoryItem;
      message?: string;
    }
  | {
      success: false;
      message: string;
    };

export type MovementsApiResponse =
  | {
      success: true;
      movements: MovementHistoryItem[];
    }
  | {
      success: false;
      message: string;
    };