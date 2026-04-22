import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsManager } from "@/components/products/products-manager";
import {
  getProductCategoryBySlug,
  PRODUCT_CATEGORIES,
} from "@/lib/product-categories";

type ProductCategoryPageProps = {
  params: Promise<{
    category: string;
  }>;
};

export async function generateStaticParams() {
  return PRODUCT_CATEGORIES.map((item) => ({
    category: item.slug,
  }));
}

export default async function ProductCategoryPage({
  params,
}: ProductCategoryPageProps) {
  const user = await requireUser();
  const { category } = await params;

  const currentCategory = getProductCategoryBySlug(category);

  if (!currentCategory) {
    notFound();
  }

  const products = await prisma.product.findMany({
    where: {
      isArchived: false,
      category: currentCategory.value,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      barcode: true,
      quantity: true,
      updatedAt: true,
      isArchived: true,
      category: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/products"
          className="inline-block text-sm text-muted-foreground hover:underline"
        >
          ← Назад к разделам
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">
          {currentCategory.label}
        </h1>

        <p className="text-sm text-muted-foreground">
          Управление товарами категории «{currentCategory.label}».
        </p>
      </div>

      <ProductsManager
        role={user.role}
        category={currentCategory.value}
        initialProducts={products.map((product) => ({
          ...product,
          updatedAt: product.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}