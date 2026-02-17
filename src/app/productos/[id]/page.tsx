import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct } from "@/lib/actions/products";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PRODUCT_TYPE_LABELS,
} from "@/lib/constants/categories";
import { Pencil } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductoDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={product.name} description={product.code} backHref="/productos" />

      <Button asChild size="sm">
        <Link href={`/productos/${id}/editar`}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Link>
      </Button>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del producto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <Badge variant="secondary">{PRODUCT_TYPE_LABELS[product.type]}</Badge>
            </div>
            {product.category && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoría</span>
                <span>{product.category.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio Venta</span>
              <span className="font-medium">{product.salePrice ? formatCurrency(product.salePrice) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio Alquiler</span>
              <span className="font-medium">{product.rentalPrice ? formatCurrency(product.rentalPrice) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo</span>
              <span className="font-medium">{product.cost ? formatCurrency(product.cost) : "—"}</span>
            </div>
            {product.description && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Descripción</span>
                <p className="mt-1">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario ({product.inventoryItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {product.inventoryItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin items en inventario</p>
            ) : (
              <div className="space-y-3">
                {product.inventoryItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <span className="font-medium">Cantidad: {item.quantityOnHand}</span>
                      <span className="ml-4 text-muted-foreground">Usos: {item.usageCount}</span>
                    </div>
                    <StatusBadge status={item.status} type="inventory" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {product.orderItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos registrados</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium"># Pedido</th>
                    <th className="p-3 text-left font-medium">Cliente</th>
                    <th className="p-3 text-left font-medium">Fecha</th>
                    <th className="p-3 text-right font-medium">Precio Unitario</th>
                    <th className="p-3 text-center font-medium">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {product.orderItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">
                        <Link href={`/pedidos/${item.order.id}`} className="text-primary hover:underline">
                          #{item.order.orderNumber}
                        </Link>
                      </td>
                      <td className="p-3">{item.order.client.name}</td>
                      <td className="p-3">{formatDate(item.order.orderDate)}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
