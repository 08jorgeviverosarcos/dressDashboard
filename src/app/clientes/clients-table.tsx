"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/shared/DataTable";

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  orders: { id: string }[];
}

interface ClientsTableProps {
  clients: ClientRow[];
}

const columns: Column<ClientRow>[] = [
  {
    key: "name",
    header: "Nombre",
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: "phone",
    header: "Tel\u00e9fono",
    cell: (row) => row.phone || "\u2014",
  },
  {
    key: "email",
    header: "Email",
    cell: (row) => row.email || "\u2014",
  },
  {
    key: "orders",
    header: "Pedidos",
    cell: (row) => row.orders.length,
    className: "text-center",
  },
];

export function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={clients}
      onRowClick={(row) => router.push(`/clientes/${row.id}`)}
      emptyMessage="No se encontraron clientes"
    />
  );
}
