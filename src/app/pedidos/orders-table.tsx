"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS_LABELS } from "@/lib/constants/categories";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calculatePaidPercentage } from "@/lib/business/profit";
import { deleteOrder } from "@/lib/actions/orders";
import { Trash2 } from "lucide-react";

interface OrderRow {
  id: string;
  orderNumber: number;
  orderDate: string;
  eventDate: string | null;
  totalPrice: number | string;
  status: string;
  client: { name: string };
  payments: { amount: number | string }[];
}

interface OrdersTableProps {
  orders: OrderRow[];
  currentStatus?: string;
}

export function OrdersTable({ orders, currentStatus }: OrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const statusFilters = ["ALL", ...Object.keys(ORDER_STATUS_LABELS)];

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deleteOrder(deletingId);
    setDeleteLoading(false);
    setDeletingId(null);
    if (result.success) {
      toast.success("Pedido eliminado");
    } else {
      toast.error(result.error);
    }
  }

  function handleStatusFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "ALL") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  const columns: Column<OrderRow>[] = [
    { key: "number", header: "#", cell: (row) => <span className="font-medium">#{row.orderNumber}</span> },
    { key: "client", header: "Cliente", cell: (row) => row.client.name },
    { key: "date", header: "Fecha", cell: (row) => formatDate(row.orderDate) },
    { key: "event", header: "Evento", cell: (row) => row.eventDate ? formatDate(row.eventDate) : "—" },
    { key: "total", header: "Total", cell: (row) => formatCurrency(row.totalPrice), className: "text-right" },
    {
      key: "paid",
      header: "% Pagado",
      cell: (row) => {
        const pct = calculatePaidPercentage(row.payments, row.totalPrice);
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs">{pct.toFixed(0)}%</span>
          </div>
        );
      },
    },
    { key: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
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
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchInput placeholder="Buscar por # o cliente..." />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((status) => (
          <Badge
            key={status}
            variant={(currentStatus ?? "ALL") === status ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => handleStatusFilter(status)}
          >
            {status === "ALL" ? "Todos" : ORDER_STATUS_LABELS[status]}
          </Badge>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        onRowClick={(row) => router.push(`/pedidos/${row.id}`)}
        emptyMessage="No se encontraron pedidos"
      />
    </div>
    <ConfirmDialog
      open={!!deletingId}
      onOpenChange={(open) => !open && setDeletingId(null)}
      title="Eliminar pedido"
      description="¿Estás seguro de que deseas eliminar este pedido? Se eliminarán también sus pagos y datos de renta. Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      variant="destructive"
      onConfirm={handleDelete}
      loading={deleteLoading}
    />
    </>
  );
}
