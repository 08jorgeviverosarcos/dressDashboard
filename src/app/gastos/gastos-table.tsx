"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from "@/lib/constants/categories";

interface ExpenseRow {
  id: string;
  date: string;
  category: string;
  subcategory: string | null;
  description: string;
  responsible: string | null;
  amount: number | string;
  expenseType: string;
  paymentMethod: string;
  orderId: string | null;
  order: { id: string; orderNumber: number } | null;
}

interface GastosTableProps {
  expenses: ExpenseRow[];
}

export function GastosTable({ expenses }: GastosTableProps) {
  const columns: Column<ExpenseRow>[] = [
    { key: "date", header: "Fecha", cell: (row) => formatDate(row.date) },
    { key: "category", header: "Categoría", cell: (row) => row.category },
    { key: "subcategory", header: "Subcategoría", cell: (row) => row.subcategory ?? "—" },
    { key: "description", header: "Descripción", cell: (row) => row.description },
    { key: "responsible", header: "Encargado", cell: (row) => row.responsible ?? "—" },
    {
      key: "amount",
      header: "Valor",
      cell: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span>,
      className: "text-right",
    },
    {
      key: "type",
      header: "Tipo",
      cell: (row) => <Badge variant="secondary">{EXPENSE_TYPE_LABELS[row.expenseType] ?? row.expenseType}</Badge>,
    },
    {
      key: "method",
      header: "Método",
      cell: (row) => <Badge variant="outline">{PAYMENT_METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}</Badge>,
    },
    {
      key: "order",
      header: "Pedido",
      cell: (row) =>
        row.order ? (
          <Link href={`/pedidos/${row.order.id}`} className="text-primary hover:underline">
            #{row.order.orderNumber}
          </Link>
        ) : (
          "—"
        ),
    },
  ];

  return <DataTable columns={columns} data={expenses} emptyMessage="No se encontraron gastos" />;
}
