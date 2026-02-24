"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from "@/lib/constants/categories";
import { deleteExpense } from "@/lib/actions/expenses";
import { Trash2 } from "lucide-react";

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
  orderItemId: string | null;
  orderItem: {
    id: string;
    product: { name: string; code: string };
    order: { id: string; orderNumber: number };
  } | null;
}

interface GastosTableProps {
  expenses: ExpenseRow[];
}

export function GastosTable({ expenses }: GastosTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deleteExpense(deletingId);
    setDeleteLoading(false);
    setDeletingId(null);
    if (result.success) {
      toast.success("Gasto eliminado");
    } else {
      toast.error(result.error);
    }
  }

  const columns: Column<ExpenseRow>[] = [
    { key: "date", header: "Fecha", cell: (row) => formatDate(row.date) },
    { key: "category", header: "Categoría", cell: (row) => row.category },
    { key: "subcategory", header: "Subcategoría", cell: (row) => row.subcategory ?? "—", className: "hidden md:table-cell" },
    { key: "description", header: "Descripción", cell: (row) => row.description, className: "hidden md:table-cell" },
    { key: "responsible", header: "Encargado", cell: (row) => row.responsible ?? "—", className: "hidden md:table-cell" },
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
      className: "hidden md:table-cell",
    },
    {
      key: "order",
      header: "Pedido / Item",
      className: "hidden md:table-cell",
      cell: (row) =>
        row.orderItem ? (
          <Link href={`/pedidos/${row.orderItem.order.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            #{row.orderItem.order.orderNumber} — {row.orderItem.product.name}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingId(row.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <SearchInput placeholder="Buscar por descripción, categoría..." />
        <DataTable
          columns={columns}
          data={expenses}
          onRowClick={(row) => router.push(`/gastos/${row.id}`)}
          emptyMessage="No se encontraron gastos"
        />
      </div>
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Eliminar gasto"
        description="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
