import { notFound } from "next/navigation";
import { getRental } from "@/lib/actions/rentals";
import { getOrder } from "@/lib/actions/orders";
import { PageHeader } from "@/components/shared/PageHeader";
import { RentalManager } from "./rental-manager";
import { toDecimalNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AlquilerPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) return notFound();

  const rentalItems = order.items.filter((item) => item.itemType === "RENTAL");
  const selectedOrderItemId =
    rentalItems.find((item) => !!item.rental)?.id ?? rentalItems[0]?.id ?? null;
  const rental = selectedOrderItemId ? await getRental(selectedOrderItemId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Alquiler — Pedido #${order.orderNumber}`}
        description={order.client.name}
        backHref={`/pedidos/${id}`}
      />
      <RentalManager
        orderId={id}
        orderItemId={selectedOrderItemId}
        rental={rental ? JSON.parse(JSON.stringify(rental)) : null}
        orderTotal={toDecimalNumber(order.totalPrice)}
      />
    </div>
  );
}
