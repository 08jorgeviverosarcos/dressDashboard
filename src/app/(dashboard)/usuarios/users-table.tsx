"use client";

import { DataTable, type Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteUser } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "SALES";
  createdAt: Date;
};

type Props = {
  users: User[];
  currentUserId: string;
};

export function UsersTable({ users, currentUserId }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!deletingId) return;
    setLoading(true);
    const result = await deleteUser(deletingId);
    setLoading(false);
    if (result.success) {
      toast.success("Usuario eliminado");
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  }

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (user) => user.name,
    },
    {
      key: "email",
      header: "Email",
      cell: (user) => user.email,
    },
    {
      key: "role",
      header: "Rol",
      cell: (user) => (
        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
          {user.role === "ADMIN" ? "Admin" : "Ventas"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (user) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/usuarios/${user.id}/editar`);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {user.id !== currentUserId ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingId(user.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={users} emptyMessage="No hay usuarios" />
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Eliminar usuario"
        description="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={loading}
      />
    </>
  );
}
