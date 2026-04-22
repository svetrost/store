export type ProductListItem = {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  updatedAt: string;
  isArchived: boolean;
};

export type ProductApiResponse =
  | {
      success: true;
      product: ProductListItem;
      message?: string;
    }
  | {
      success: false;
      message: string;
    };

export type ProductsApiResponse =
  | {
      success: true;
      products: ProductListItem[];
    }
  | {
      success: false;
      message: string;
    };