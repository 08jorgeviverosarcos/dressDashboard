import { getCategories } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProductForm } from "../product-form";

export default async function NuevoProductoPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Producto" backHref="/productos" />
      <ProductForm categories={categories} />
    </div>
  );
}
