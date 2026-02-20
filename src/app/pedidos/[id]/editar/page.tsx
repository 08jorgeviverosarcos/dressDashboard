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
          type: p.type,
          salePrice: p.salePrice ? Number(p.salePrice) : null,
          rentalPrice: p.rentalPrice ? Number(p.rentalPrice) : null,
          cost: p.cost ? Number(p.cost) : null,
          description: p.description ?? null,
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
            itemType: i.itemType,
            productId: i.productId ?? "",
            name: i.name,
            description: i.description ?? "",
            quantity: i.quantity,
            unitPrice: toDecimalNumber(i.unitPrice),
            discountType: i.discountType ?? null,
            discountValue: i.discountValue ? toDecimalNumber(i.discountValue) : null,
            costAmount: toDecimalNumber(i.costAmount),
            rentalPickupDate: i.rental?.pickupDate
              ? i.rental.pickupDate.toISOString().split("T")[0]
              : "",
            rentalReturnDate: i.rental?.returnDate
              ? i.rental.returnDate.toISOString().split("T")[0]
              : "",
          })),
        }}
      />
    </div>
  );
}
