import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/lib/actions/orders";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PaymentTimeline } from "@/components/orders/PaymentTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, toDecimalNumber } from "@/lib/utils";
import { calculatePaidAmount, calculatePaidPercentage } from "@/lib/business/profit";
import { Pencil, Calendar, User, FileText, Truck } from "lucide-react";
import { OrderActions } from "./order-actions";
import type { OrderStatus } from "@prisma/client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PedidoDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return notFound();

  const totalPrice = toDecimalNumber(order.totalPrice);
  const totalCost = toDecimalNumber(order.totalCost);
  const totalPaid = calculatePaidAmount(order.payments);
  const paidPct = calculatePaidPercentage(order.payments, order.totalPrice);
  const remaining = totalPrice - totalPaid;
  const profit = order.status === "COMPLETED" ? totalPrice - totalCost : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido #${order.orderNumber}`}
        backHref="/pedidos"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          {order.rental && <Badge variant="secondary">Alquiler</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pedidos/${id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          {order.rental && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/pedidos/${id}/alquiler`}>
                Gestionar Alquiler
              </Link>
            </Button>
          )}
        </div>
      </div>

      <OrderActions
        orderId={id}
        currentStatus={order.status as OrderStatus}
        orderTotal={totalPrice}
        totalPaid={totalPaid}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{formatCurrency(totalPrice)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Pagado</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
            <div className="text-xs text-muted-foreground">{paidPct.toFixed(0)}% del total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Restante</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(remaining)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              {profit !== null ? "Ganancia" : "Costo"}
            </div>
            <div className={`text-2xl font-bold ${profit !== null ? (profit >= 0 ? "text-green-600" : "text-red-600") : ""}`}>
              {profit !== null ? formatCurrency(profit) : formatCurrency(totalCost)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Link href={`/clientes/${order.clientId}`} className="text-primary hover:underline">
                {order.client.name}
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Pedido: {formatDate(order.orderDate)}</span>
            </div>
            {order.eventDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Evento: {formatDate(order.eventDate)}</span>
              </div>
            )}
            {order.deliveryDate && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>Entrega: {formatDate(order.deliveryDate)}</span>
              </div>
            )}
            <div className="text-muted-foreground">
              Abono mínimo: {toDecimalNumber(order.minDownpaymentPct)}%
            </div>
            {order.notes && (
              <div className="flex items-start gap-2 pt-2 border-t">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{order.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Pagos ({order.payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentTimeline
              payments={JSON.parse(JSON.stringify(order.payments))}
              totalPrice={totalPrice}
            />
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Productos ({order.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Código</th>
                  <th className="p-3 text-left font-medium">Producto</th>
                  <th className="p-3 text-center font-medium">Cant.</th>
                  <th className="p-3 text-right font-medium">Precio Unit.</th>
                  <th className="p-3 text-right font-medium">Costo</th>
                  <th className="p-3 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 font-medium">{item.product.code}</td>
                    <td className="p-3">{item.product.name}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-3 text-right">{formatCurrency(item.costAmount)}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.quantity * toDecimalNumber(item.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Linked Expenses */}
      {order.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gastos Vinculados ({order.expenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Fecha</th>
                    <th className="p-3 text-left font-medium">Categoría</th>
                    <th className="p-3 text-left font-medium">Descripción</th>
                    <th className="p-3 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {order.expenses.map((expense) => (
                    <tr key={expense.id} className="border-b">
                      <td className="p-3">{formatDate(expense.date)}</td>
                      <td className="p-3">{expense.category}</td>
                      <td className="p-3">{expense.description}</td>
                      <td className="p-3 text-right">{formatCurrency(expense.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
