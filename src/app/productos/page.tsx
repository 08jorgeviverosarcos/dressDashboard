import { getProducts } from "@/lib/actions/products";
import { PageHeader } from "@/components/shared/PageHeader";
import { PRODUCT_TYPE_LABELS, PRODUCT_CATEGORY_LABELS } from "@/lib/constants/categories";
import { formatCurrency } from "@/lib/utils";
import type { ProductType } from "@prisma/client";
import { ProductsTable } from "./products-table";

interface ProductosPageProps {
  searchParams: Promise<{
    search?: string;
    type?: string;
  }>;
}

export default async function ProductosPage({ searchParams }: ProductosPageProps) {
  const params = await searchParams;

  const products = await getProducts({
    search: params.search,
    type: params.type as ProductType | undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Gestiona el catálogo de productos"
        actionLabel="Nuevo Producto"
        actionHref="/productos/nuevo"
      />

      <ProductsTable
        products={JSON.parse(JSON.stringify(products))}
        currentType={params.type}
      />
    </div>
  );
}
