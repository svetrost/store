import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ProductDetailsManager } from "@/components/products/product-details-manager";
import { getProductDetailsById } from "@/server/services/product-details-service";

type ProductDetailsPageProps = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveParams(
  params: ProductDetailsPageProps["params"]
): Promise<{ id: string }> {
  return await Promise.resolve(params);
}

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const currentUser = await requireUser();

  const { id } = await resolveParams(params);
  const data = await getProductDetailsById(id);

  if (!data) {
    notFound();
  }

  return (
    <ProductDetailsManager
      initialData={data}
      currentUserRole={currentUser.role}
    />
  );
}