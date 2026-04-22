import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";

export default async function ProductsPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Товары</h1>
        <p className="text-sm text-muted-foreground">
          Выберите раздел, чтобы открыть список товаров этой категории.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRODUCT_CATEGORIES.map((category) => (
          <Link
            key={category.value}
            href={`/products/category/${category.slug}`}
            className="rounded-2xl border bg-background p-5 transition hover:bg-muted/40"
          >
            <div className="space-y-2">
              <h2 className="text-lg font-medium">{category.label}</h2>
              <p className="text-sm text-muted-foreground">
                {category.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}