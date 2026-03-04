import { getProducts } from "@/lib/actions/products";
import { getCategories } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryItemForm } from "./inventory-item-form";
import type { CategoryOptionSource, ProductOptionSource } from "@/types";

export default async function NuevoInventarioPage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Agregar Item" backHref="/inventario" />
      <InventoryItemForm
        products={products.map((p: Pick<ProductOptionSource, "id" | "code" | "name" | "inventoryTracking">) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          inventoryTracking: p.inventoryTracking,
        }))}
        categories={categories.map((c: CategoryOptionSource) => ({
          id: c.id,
          name: c.name,
          code: c.code,
        }))}
      />
    </div>
  );
}
