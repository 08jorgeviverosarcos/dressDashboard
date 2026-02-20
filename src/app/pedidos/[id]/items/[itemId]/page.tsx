import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderItem } from "@/lib/actions/orders";
import { getRental } from "@/lib/actions/rentals";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, toDecimalNumber } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { DeleteOrderItemButton } from "./delete-order-item-button";
import { RentalManager } from "./rental-manager";

interface Props {
  params: Promise<{ id: string; itemId: string }>;
}

export default async function OrderItemDetailPage({ params }: Props) {
  const { id, itemId } = await params;
  const item = await getOrderItem(itemId);

  if (!item || item.order.id !== id) return notFound();

  const lineTotal = item.quantity * toDecimalNumber(item.unitPrice);
  const discountVal = item.discountValue ? toDecimalNumber(item.discountValue) : 0;
  const subtotal =
    item.discountType === "FIXED"
      ? lineTotal - discountVal
      : item.discountType === "PERCENTAGE"
        ? lineTotal * (1 - discountVal / 100)
        : lineTotal;

  const rental = item.itemType === "RENTAL"
    ? await getRental(item.id)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.name}
        description={`Pedido #${item.order.orderNumber}`}
        backHref={`/pedidos/${id}`}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/pedidos/${id}/items/${item.id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
        <DeleteOrderItemButton
          orderItemId={item.id}
          itemName={item.name}
          orderId={id}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <Badge variant="outline">
              {item.itemType === "SALE"
                ? "Venta"
                : item.itemType === "RENTAL"
                  ? "Alquiler"
                  : "Servicio"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre</span>
            <span>{item.name}</span>
          </div>
          {item.description && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descripción</span>
              <span>{item.description}</span>
            </div>
          )}
          {item.product && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código</span>
              <span>{item.product.code}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cantidad</span>
            <span>{item.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precio unitario</span>
            <span>{formatCurrency(item.unitPrice)}</span>
          </div>
          {item.discountType && item.discountValue && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span>
                {item.discountType === "PERCENTAGE"
                  ? `${toDecimalNumber(item.discountValue)}%`
                  : formatCurrency(item.discountValue)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Costo</span>
            <span>{formatCurrency(item.costAmount)}</span>
          </div>
          <div className="flex justify-between font-medium border-t pt-3">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        </CardContent>
      </Card>

      {item.itemType === "RENTAL" && (
        <RentalManager
          orderId={id}
          orderItemId={item.id}
          rental={rental ? JSON.parse(JSON.stringify(rental)) : null}
        />
      )}
    </div>
  );
}
