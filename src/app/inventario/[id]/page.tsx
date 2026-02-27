import { notFound } from "next/navigation";
import { getInventoryItem } from "@/lib/actions/inventory";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { INVENTORY_STATUS_LABELS } from "@/lib/constants/categories";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InventarioDetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getInventoryItem(id);

  if (!item) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${item.product.code} — ${item.product.name}`}
        backHref="/inventario"
      />

      <Card>
        <CardHeader>
          <CardTitle>Información del item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Producto</span>
            <span className="font-medium">{item.product.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Código</span>
            <span>{item.product.code}</span>
          </div>
          {item.assetCode && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código unidad</span>
              <span className="font-medium">{item.assetCode}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cantidad</span>
            <span>{item.quantityOnHand}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant="secondary">
              {INVENTORY_STATUS_LABELS[item.status as keyof typeof INVENTORY_STATUS_LABELS] ?? item.status}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Número de usos</span>
            <span>{item.usageCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha de adquisición</span>
            <span>{formatDate(item.acquiredAt)}</span>
          </div>
          {item.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notas</span>
              <span>{item.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
