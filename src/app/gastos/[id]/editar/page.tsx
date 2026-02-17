import { notFound } from "next/navigation";
import { getExpense } from "@/lib/actions/expenses";
import { getOrders } from "@/lib/actions/orders";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { toDecimalNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarGastoPage({ params }: Props) {
  const { id } = await params;
  const [expense, orders] = await Promise.all([getExpense(id), getOrders()]);

  if (!expense) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Gasto" backHref="/gastos" />
      <ExpenseForm
        orders={orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber }))}
        initialData={{
          id: expense.id,
          date: expense.date.toISOString().split("T")[0],
          category: expense.category,
          subcategory: expense.subcategory ?? "",
          description: expense.description,
          responsible: expense.responsible ?? "",
          amount: toDecimalNumber(expense.amount),
          expenseType: expense.expenseType,
          paymentMethod: expense.paymentMethod,
          orderId: expense.orderId ?? "",
        }}
      />
    </div>
  );
}
