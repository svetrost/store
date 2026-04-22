export type BackupEntityCounts = {
  users: number;
  products: number;
  stockMovements: number;
  auditLogs: number;
};

export type BackupOverview = BackupEntityCounts;

export type RestoreBackupApiResponse =
  | {
      success: true;
      message: string;
      summary: BackupEntityCounts;
      warnings: string[];
    }
  | {
      success: false;
      message: string;
    };

export type BackupErrorApiResponse = {
  success: false;
  message: string;
};