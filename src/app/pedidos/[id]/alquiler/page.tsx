import { notFound } from "next/navigation";
import Link from "next/link";
import { getRental } from "@/lib/actions/rentals";
import { getOrder } from "@/lib/actions/orders";
import { PageHeader } from "@/components/shared/PageHeader";
import { RentalManager } from "./rental-manager";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ itemId?: string }>;
}

export default async function AlquilerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { itemId } = await searchParams;
  const order = await getOrder(id);

  if (!order) return notFound();

  const rentalItems = order.items.filter((item) => item.itemType === "RENTAL");

  if (rentalItems.length === 0) return notFound();

  // Select item: prefer URL param → first with existing rental → first in list
  const selectedItem =
    (itemId ? rentalItems.find((item) => item.id === itemId) : null) ??
    rentalItems.find((item) => !!item.rental) ??
    rentalItems[0];

  const rental = await getRental(selectedItem.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Alquiler — Pedido #${order.orderNumber}`}
        description={order.client.name}
        backHref={`/pedidos/${id}`}
      />

      {/* Tabs — only shown when there are multiple rental items */}
      {rentalItems.length > 1 && (
        <div className="flex gap-1 border-b">
          {rentalItems.map((item) => (
            <Link
              key={item.id}
              href={`/pedidos/${id}/alquiler?itemId=${item.id}`}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                item.id === selectedItem.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}

      <RentalManager
        orderId={id}
        orderItemId={selectedItem.id}
        rental={rental ? JSON.parse(JSON.stringify(rental)) : null}
      />
    </div>
  );
}
