import { notFound } from "next/navigation";
import Link from "next/link";
import { getExpense } from "@/lib/actions/expenses";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from "@/lib/constants/categories";
import { Pencil } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GastoDetailPage({ params }: Props) {
  const { id } = await params;
  const expense = await getExpense(id);

  if (!expense) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={expense.description}
        backHref="/gastos"
      />

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href={`/gastos/${id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del gasto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha</span>
            <span>{formatDate(expense.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Categoría</span>
            <span>{expense.category}{expense.subcategory ? ` / ${expense.subcategory}` : ""}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto</span>
            <span className="font-medium">{formatCurrency(expense.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <Badge variant="secondary">{EXPENSE_TYPE_LABELS[expense.expenseType] ?? expense.expenseType}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Método de pago</span>
            <Badge variant="outline">{PAYMENT_METHOD_LABELS[expense.paymentMethod] ?? expense.paymentMethod}</Badge>
          </div>
          {expense.responsible && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Encargado</span>
              <span>{expense.responsible}</span>
            </div>
          )}
          {expense.orderItem && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedido vinculado</span>
              <Link
                href={`/pedidos/${expense.orderItem.order.id}`}
                className="text-primary hover:underline"
              >
                #{expense.orderItem.order.orderNumber} — {expense.orderItem.product.name}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
