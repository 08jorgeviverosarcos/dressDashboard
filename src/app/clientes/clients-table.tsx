"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { deleteClient } from "@/lib/actions/clients";
import { Trash2 } from "lucide-react";

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

export function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deleteClient(deletingId);
    setDeleteLoading(false);
    setDeletingId(null);
    if (result.success) {
      toast.success("Cliente eliminado");
    } else {
      toast.error(result.error);
    }
  }

  const columns: Column<ClientRow>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (row) => row.phone || "—",
    },
    {
      key: "email",
      header: "Email",
      cell: (row) => row.email || "—",
    },
    {
      key: "orders",
      header: "Pedidos",
      cell: (row) => row.orders.length,
      className: "text-center",
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
        <SearchInput placeholder="Buscar por nombre, teléfono o email..." />
        <DataTable
          columns={columns}
          data={clients}
          onRowClick={(row) => router.push(`/clientes/${row.id}`)}
          emptyMessage="No se encontraron clientes"
        />
      </div>
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Eliminar cliente"
        description="¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
