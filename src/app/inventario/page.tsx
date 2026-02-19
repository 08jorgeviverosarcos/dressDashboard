import { getInventoryItems } from "@/lib/actions/inventory";
import { getProducts } from "@/lib/actions/products";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryTable } from "./inventory-table";
import type { InventoryStatus } from "@prisma/client";

interface Props {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function InventarioPage({ searchParams }: Props) {
  const params = await searchParams;

  const [items, products] = await Promise.all([
    getInventoryItems({
      search: params.search,
      status: params.status as InventoryStatus | undefined,
    }),
    getProducts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventario" description="Gestiona el inventario de productos" />
      <InventoryTable
        items={JSON.parse(JSON.stringify(items))}
        products={products.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
        currentStatus={params.status}
      />
    </div>
  );
}
