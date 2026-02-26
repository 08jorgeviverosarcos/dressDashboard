import { getProducts } from "@/lib/actions/products";
import { getCategories } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryItemForm } from "./inventory-item-form";

export default async function NuevoInventarioPage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Agregar Item" backHref="/inventario" />
      <InventoryItemForm
        products={products.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
      />
    </div>
  );
}
