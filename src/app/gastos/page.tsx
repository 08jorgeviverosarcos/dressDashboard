import { getExpenses } from "@/lib/actions/expenses";
import { PageHeader } from "@/components/shared/PageHeader";
import { GastosTable } from "./gastos-table";
import type { ExpenseType } from "@prisma/client";

interface Props {
  searchParams: Promise<{ search?: string; category?: string; expenseType?: string }>;
}

export default async function GastosPage({ searchParams }: Props) {
  const params = await searchParams;
  const expenses = await getExpenses({
    search: params.search,
    category: params.category,
    expenseType: params.expenseType as ExpenseType | undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos"
        description="Registro de gastos del negocio"
        actionLabel="Nuevo Gasto"
        actionHref="/gastos/nuevo"
      />
      <GastosTable expenses={JSON.parse(JSON.stringify(expenses))} />
    </div>
  );
}
