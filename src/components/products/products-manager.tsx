"use client";

import type { ProductCategory, UserRole } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Barcode, Download, Pencil, Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { ProductListItem } from "@/types/product";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { BarcodePreviewDialog } from "@/components/products/barcode-preview-dialog";
import { ProductArchiveToggleButton } from "@/components/products/product-archive-toggle-button";

type ProductsManagerProps = {
  initialProducts: ProductListItem[];
  role: UserRole;
  category: ProductCategory;
};

type ArchiveFilter = "all" | "active" | "archived";

function sortProducts(items: ProductListItem[]) {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function ProductsManager({
  initialProducts,
  role,
  category,
}: ProductsManagerProps) {
  const canManage = role === "ADMIN" || role === "SUPERADMIN";

  const [products, setProducts] = useState<ProductListItem[]>(
    sortProducts(initialProducts)
  );
  const [query, setQuery] = useState("");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(
    null
  );
  const [barcodeProduct, setBarcodeProduct] = useState<ProductListItem | null>(
    null
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.barcode.toLowerCase().includes(normalizedQuery);

      const matchesArchive =
        archiveFilter === "all" ||
        (archiveFilter === "active" && !product.isArchived) ||
        (archiveFilter === "archived" && product.isArchived);

      return matchesQuery && matchesArchive;
    });
  }, [products, query, archiveFilter]);

  const productsExportHref = useMemo(() => {
    const normalizedQuery = query.trim();

    return normalizedQuery
      ? `/api/excel/products-export?search=${encodeURIComponent(
          normalizedQuery
        )}`
      : "/api/excel/products-export";
  }, [query]);

  const totalProducts = products.length;
  const totalQuantity = products.reduce(
    (sum, product) => sum + product.quantity,
    0
  );
  const filteredQuantity = filteredProducts.reduce(
    (sum, product) => sum + product.quantity,
    0
  );
  const archivedProductsCount = products.filter((product) => product.isArchived)
    .length;

  function handleProductUpsert(product: ProductListItem) {
    setProducts((previous) =>
      sortProducts([
        product,
        ...previous.filter((item) => item.id !== product.id),
      ])
    );
  }

  function handleArchiveStateChange(updatedProduct: {
    id: string;
    isArchived: boolean;
    updatedAt: string;
  }) {
    setProducts((previous) =>
      sortProducts(
        previous.map((item) =>
          item.id === updatedProduct.id
            ? {
                ...item,
                isArchived: updatedProduct.isArchived,
                updatedAt: updatedProduct.updatedAt,
              }
            : item
        )
      )
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Товары"
        description="Просмотр остатков, поиск по названию и штрих-коду, архивирование, добавление и редактирование товаров."
        actions={
          <div className="flex flex-wrap gap-3">
            <a
              href={productsExportHref}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Экспорт Excel
            </a>

            {canManage ? (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                Добавить товар
              </button>
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Управление товарами доступно только администратору
              </div>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Всего товаров</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(totalProducts)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Общий остаток</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(totalQuantity)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Найдено по фильтру</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(filteredProducts.length)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Остаток по фильтру</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(filteredQuantity)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Архивных товаров</div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {formatNumber(archivedProductsCount)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по названию или штрих-коду"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-11 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                  aria-label="Очистить поиск"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Ищи товар по названию, коду или архивному статусу
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setArchiveFilter("all")}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition ${
                archiveFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Все
            </button>

            <button
              type="button"
              onClick={() => setArchiveFilter("active")}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition ${
                archiveFilter === "active"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Только активные
            </button>

            <button
              type="button"
              onClick={() => setArchiveFilter("archived")}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition ${
                archiveFilter === "archived"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Только архив
            </button>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          title={
            products.length === 0
              ? "Товары пока не добавлены"
              : "По запросу ничего не найдено"
          }
          description={
            products.length === 0
              ? "Создай первый товар, и система автоматически сформирует для него уникальный штрих-код."
              : "Попробуй изменить строку поиска или фильтр архива."
          }
          action={
            canManage && products.length === 0 ? (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                Добавить первый товар
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        className="text-base font-semibold text-slate-900 transition hover:text-teal-700"
                      >
                        {product.name}
                      </Link>

                      {product.isArchived ? (
                        <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                          Архивный
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {product.barcode}
                    </div>
                  </div>

                  <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {formatNumber(product.quantity)} шт.
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-600">
                  Обновлено: {formatDateTime(product.updatedAt)}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBarcodeProduct(product)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Barcode className="mr-2 h-4 w-4" />
                    Штрих-код
                  </button>

                  <ProductArchiveToggleButton
                    productId={product.id}
                    isArchived={product.isArchived}
                    canManage={canManage}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onSuccess={handleArchiveStateChange}
                  />

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => setEditingProduct(product)}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Редактировать
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Название</th>
                    <th className="px-4 py-3 font-medium">Штрих-код</th>
                    <th className="px-4 py-3 font-medium">Остаток</th>
                    <th className="px-4 py-3 font-medium">Обновлено</th>
                    <th className="px-4 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/products/${product.id}`}
                            className="font-medium text-slate-900 transition hover:text-teal-700"
                          >
                            {product.name}
                          </Link>

                          {product.isArchived ? (
                            <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                              Архивный
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {product.barcode}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNumber(product.quantity)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateTime(product.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setBarcodeProduct(product)}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Barcode className="mr-2 h-4 w-4" />
                            Штрих-код
                          </button>

                          <ProductArchiveToggleButton
                            productId={product.id}
                            isArchived={product.isArchived}
                            canManage={canManage}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onSuccess={handleArchiveStateChange}
                          />

                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => setEditingProduct(product)}
                              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Редактировать
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ProductFormDialog
        open={isCreateOpen}
        mode="create"
        category={category}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleProductUpsert}
      />

      <ProductFormDialog
        open={Boolean(editingProduct)}
        mode="edit"
        category={category}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={handleProductUpsert}
      />

      <BarcodePreviewDialog
        open={Boolean(barcodeProduct)}
        product={barcodeProduct}
        canManage={canManage}
        onClose={() => setBarcodeProduct(null)}
        onProductUpdate={(product) => {
          handleProductUpsert(product);
          setBarcodeProduct(product);
        }}
      />
    </section>
  );
}