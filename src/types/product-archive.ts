export type ProductArchiveApiResponse =
  | {
      success: true;
      message: string;
      product: {
        id: string;
        isArchived: boolean;
        updatedAt: string;
      };
    }
  | {
      success: false;
      message: string;
    };