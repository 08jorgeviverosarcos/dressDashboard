import { getClients } from "@/lib/actions/clients";
import { getProducts } from "@/lib/actions/products";
import { PageHeader } from "@/components/shared/PageHeader";
import { OrderForm } from "@/components/orders/OrderForm";

export default async function NuevoPedidoPage() {
  const [clients, products] = await Promise.all([getClients(), getProducts()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Pedido" backHref="/pedidos" />
      <OrderForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        products={products.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          type: p.type,
          salePrice: p.salePrice ? Number(p.salePrice) : null,
          rentalPrice: p.rentalPrice ? Number(p.rentalPrice) : null,
          cost: p.cost ? Number(p.cost) : null,
          description: p.description ?? null,
        }))}
      />
    </div>
  );
}
