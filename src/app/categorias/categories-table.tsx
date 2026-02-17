"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteCategory } from "@/lib/actions/categories";
import { Pencil, Trash2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
  code: string;
}

interface CategoriesTableProps {
  categories: Category[];
}

export function CategoriesTable({ categories }: CategoriesTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const columns: Column<Category>[] = [
    {
      key: "code",
      header: "Código",
      cell: (row) => <span className="font-medium">{row.code}</span>,
    },
    {
      key: "name",
      header: "Nombre",
      cell: (row) => row.name,
    },
    {
      key: "id",
      header: "",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/categorias/${row.id}/editar`);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
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

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deleteCategory(deletingId);
    setDeleteLoading(false);
    setDeletingId(null);
    if (result.success) {
      toast.success("Categoría eliminada");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={categories}
        emptyMessage="No hay categorías registradas"
      />
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Eliminar categoría"
        description="¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
