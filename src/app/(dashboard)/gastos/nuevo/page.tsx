import { getOrders } from "@/lib/actions/orders";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import type { OrderExpenseItemSource, OrderExpenseSource } from "@/types";

export default async function NuevoGastoPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Gasto" backHref="/gastos" />
      <ExpenseForm
        orders={orders.map((o: OrderExpenseSource) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          clientName: o.client?.name ?? "",
          items: o.items.map((i: OrderExpenseItemSource) => ({
            id: i.id,
            product: { name: (i.name || i.product?.name) ?? "", code: i.product?.code ?? "" },
          })),
        }))}
      />
    </div>
  );
}
