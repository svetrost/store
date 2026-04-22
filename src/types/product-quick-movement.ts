export type QuickProductMovementType = "IN" | "OUT" | "ADJUSTMENT";

export type QuickProductMovementApiResponse =
  | {
      success: true;
      message: string;
      product: {
        id: string;
        quantity: number;
      };
      movement: {
        id: string;
        type: QuickProductMovementType;
        source: "MANUAL" | "ADMIN_EDIT";
        quantity: number;
        balanceBefore: number;
        balanceAfter: number;
        note: string | null;
        createdAt: string;
      };
    }
  | {
      success: false;
      message: string;
    };