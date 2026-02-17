"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS } from "@/lib/constants/categories";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calculatePaidPercentage } from "@/lib/business/profit";

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

  const statusFilters = ["ALL", ...Object.keys(ORDER_STATUS_LABELS)];

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
  ];

  return (
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
  );
}
