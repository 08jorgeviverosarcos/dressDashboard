import { notFound } from "next/navigation";
import { getOrderItem } from "@/lib/actions/orders";
import { getProducts } from "@/lib/actions/products";
import { PageHeader } from "@/components/shared/PageHeader";
import { toDecimalNumber } from "@/lib/utils";
import { OrderItemEditForm } from "./order-item-edit-form";

interface Props {
  params: Promise<{ id: string; itemId: string }>;
}

export default async function EditarOrderItemPage({ params }: Props) {
  const { id, itemId } = await params;
  const [item, products] = await Promise.all([
    getOrderItem(itemId),
    getProducts(),
  ]);

  if (!item || item.order.id !== id) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar: ${item.name}`}
        description={`Pedido #${item.order.orderNumber}`}
        backHref={`/pedidos/${id}/items/${itemId}`}
      />

      <OrderItemEditForm
        orderItemId={itemId}
        orderId={id}
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
        initialValues={{
          itemType: item.itemType,
          productId: item.productId ?? "",
          name: item.name,
          description: item.description ?? "",
          quantity: item.quantity,
          unitPrice: toDecimalNumber(item.unitPrice),
          discountType: item.discountType ?? null,
          discountValue: item.discountValue ? toDecimalNumber(item.discountValue) : null,
          costAmount: toDecimalNumber(item.costAmount),
          costSource: item.costSource,
          inventoryItemId: item.inventoryItemId ?? null,
          notes: item.notes ?? "",
          rentalReturnDate: item.rental?.returnDate
            ? item.rental.returnDate.toISOString().split("T")[0]
            : "",
          rentalDeposit: item.rental?.deposit ? toDecimalNumber(item.rental.deposit) : 0,
        }}
      />
    </div>
  );
}
