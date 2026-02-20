"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteOrderItem } from "@/lib/actions/orders";
import { formatCurrency, toDecimalNumber } from "@/lib/utils";

// Tipo serializado (Decimal → string | number)
interface OrderItemRow {
  id: string;
  itemType: "SALE" | "RENTAL" | "SERVICE";
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number | string;
  discountType: "FIXED" | "PERCENTAGE" | null;
  discountValue: number | string | null;
  costAmount: number | string;
  product: { code: string } | null;
}

interface OrderItemsTableProps {
  items: OrderItemRow[];
  orderId: string;
}

export function OrderItemsTable({ items, orderId }: OrderItemsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deleteOrderItem(deletingId);
    setDeleteLoading(false);
    setDeletingId(null);
    if (result.success) {
      toast.success("Item eliminado");
    } else {
      toast.error(result.error);
    }
  }

  const columns: Column<OrderItemRow>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (row) => (
        <Badge variant="outline">
          {row.itemType === "SALE"
            ? "Venta"
            : row.itemType === "RENTAL"
              ? "Alquiler"
              : "Servicio"}
        </Badge>
      ),
    },
    {
      key: "nombre",
      header: "Nombre",
      cell: (row) => (
        <div>
          <div>{row.name}</div>
          {row.description && (
            <div className="text-xs text-muted-foreground">{row.description}</div>
          )}
          {row.product && (
            <div className="text-xs text-muted-foreground">Cod: {row.product.code}</div>
          )}
        </div>
      ),
    },
    {
      key: "cantidad",
      header: "Cant.",
      className: "text-center",
      cell: (row) => row.quantity,
    },
    {
      key: "precioUnit",
      header: "Precio Unit.",
      className: "text-right",
      cell: (row) => formatCurrency(row.unitPrice),
    },
    {
      key: "descuento",
      header: "Descuento",
      className: "text-right",
      cell: (row) =>
        row.discountType && row.discountValue
          ? row.discountType === "PERCENTAGE"
            ? `${toDecimalNumber(row.discountValue)}%`
            : formatCurrency(row.discountValue)
          : "—",
    },
    {
      key: "costo",
      header: "Costo",
      className: "text-right",
      cell: (row) => formatCurrency(row.costAmount),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      className: "text-right",
      cell: (row) => {
        const lineTotal = row.quantity * toDecimalNumber(row.unitPrice);
        const discountVal = row.discountValue ? toDecimalNumber(row.discountValue) : 0;
        const subtotal =
          row.discountType === "FIXED"
            ? lineTotal - discountVal
            : row.discountType === "PERCENTAGE"
              ? lineTotal * (1 - discountVal / 100)
              : lineTotal;
        return <span className="font-medium">{formatCurrency(subtotal)}</span>;
      },
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
              setDeletingName(row.name);
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
      <DataTable
        columns={columns}
        data={items}
        onRowClick={(row) => router.push(`/pedidos/${orderId}/items/${row.id}`)}
        emptyMessage="Sin items en este pedido"
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Eliminar item"
        description={`¿Estás seguro de que deseas eliminar "${deletingName}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
