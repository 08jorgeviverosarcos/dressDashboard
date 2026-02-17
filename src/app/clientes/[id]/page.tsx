import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/actions/clients";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency, toDecimalNumber } from "@/lib/utils";
import { calculatePaidPercentage } from "@/lib/business/profit";
import { Pencil, Mail, Phone, FileText } from "lucide-react";
import { DeleteClientButton } from "./delete-client-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={client.name} backHref="/clientes" />

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href={`/clientes/${id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
        <DeleteClientButton clientId={id} clientName={client.name} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {client.phone}
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {client.email}
            </div>
          )}
          {client.notes && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {client.notes}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Cliente desde {formatDate(client.createdAt)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de pedidos ({client.orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {client.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pedidos registrados</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">#</th>
                    <th className="p-3 text-left font-medium">Fecha</th>
                    <th className="p-3 text-right font-medium">Total</th>
                    <th className="p-3 text-center font-medium">% Pagado</th>
                    <th className="p-3 text-center font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {client.orders.map((order) => {
                    const paidPct = calculatePaidPercentage(
                      order.payments,
                      order.totalPrice
                    );
                    return (
                      <tr key={order.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <Link
                            href={`/pedidos/${order.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            #{order.orderNumber}
                          </Link>
                        </td>
                        <td className="p-3">{formatDate(order.orderDate)}</td>
                        <td className="p-3 text-right">
                          {formatCurrency(order.totalPrice)}
                        </td>
                        <td className="p-3 text-center">{paidPct.toFixed(0)}%</td>
                        <td className="p-3 text-center">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
