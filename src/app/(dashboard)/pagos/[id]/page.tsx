import { notFound } from "next/navigation";
import Link from "next/link";
import { getPayment } from "@/lib/actions/payments";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/constants/categories";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PagoDetailPage({ params }: Props) {
  const { id } = await params;
  const payment = await getPayment(id);

  if (!payment) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pago — ${formatCurrency(payment.amount)}`}
        backHref="/pagos"
      />

      <Card>
        <CardHeader>
          <CardTitle>Información del pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha</span>
            <span>{formatDate(payment.paymentDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto</span>
            <span className="font-medium">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <Badge variant="secondary">{PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Método</span>
            <Badge variant="outline">{PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</Badge>
          </div>
          {payment.reference && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Referencia</span>
              <span>{payment.reference}</span>
            </div>
          )}
          {payment.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notas</span>
              <span>{payment.notes}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pedido</span>
            <Link href={`/pedidos/${payment.order.id}`} className="text-primary hover:underline">
              #{payment.order.orderNumber} — {payment.order.client.name}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
