import { notFound } from "next/navigation";
import { getProduct } from "@/lib/actions/products";
import { getCategories } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProductForm } from "../../product-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarProductoPage({ params }: Props) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), getCategories()]);
  if (!product) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Producto" backHref={`/productos/${id}`} />
      <ProductForm
        categories={categories}
        productId={id}
        initialData={{
          code: product.code,
          name: product.name,
          type: product.type,
          categoryId: product.categoryId ?? null,
          salePrice: product.salePrice ? Number(product.salePrice) : null,
          rentalPrice: product.rentalPrice ? Number(product.rentalPrice) : null,
          cost: product.cost ? Number(product.cost) : null,
          description: product.description ?? "",
        }}
      />
    </div>
  );
}
