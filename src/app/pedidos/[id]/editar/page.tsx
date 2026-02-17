import { notFound } from "next/navigation";
import { getOrder } from "@/lib/actions/orders";
import { getClients } from "@/lib/actions/clients";
import { getProducts } from "@/lib/actions/products";
import { PageHeader } from "@/components/shared/PageHeader";
import { OrderForm } from "@/components/orders/OrderForm";
import { toDecimalNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarPedidoPage({ params }: Props) {
  const { id } = await params;
  const [order, clients, products] = await Promise.all([
    getOrder(id),
    getClients(),
    getProducts(),
  ]);

  if (!order) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Editar Pedido #${order.orderNumber}`} backHref={`/pedidos/${id}`} />
      <OrderForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        products={products.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          salePrice: p.salePrice ? Number(p.salePrice) : null,
          cost: p.cost ? Number(p.cost) : null,
        }))}
        initialData={{
          id: order.id,
          clientId: order.clientId,
          orderDate: order.orderDate.toISOString().split("T")[0],
          eventDate: order.eventDate ? order.eventDate.toISOString().split("T")[0] : null,
          deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString().split("T")[0] : null,
          minDownpaymentPct: toDecimalNumber(order.minDownpaymentPct),
          notes: order.notes ?? "",
          items: order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: toDecimalNumber(i.unitPrice),
            costAmount: toDecimalNumber(i.costAmount),
          })),
        }}
      />
    </div>
  );
}
