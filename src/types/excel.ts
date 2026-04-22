export type ImportBatchStatusValue = "PENDING" | "COMPLETED" | "FAILED";

export type ImportBatchListItem = {
  id: string;
  fileName: string;
  status: ImportBatchStatusValue;
  rowsTotal: number;
  rowsSuccess: number;
  rowsFailed: number;
  createdAt: string;
  importedBy: {
    id: string;
    name: string;
    username: string;
  };
  reportJson: unknown | null;
};

export type ImportMovementsApiResponse =
  | {
      success: true;
      batch: ImportBatchListItem;
      summary: {
        rowsTotal: number;
        rowsSuccess: number;
        rowsFailed: number;
      };
    }
  | {
      success: false;
      message: string;
    };

export type ImportBatchesApiResponse =
  | {
      success: true;
      batches: ImportBatchListItem[];
    }
  | {
      success: false;
      message: string;
    };