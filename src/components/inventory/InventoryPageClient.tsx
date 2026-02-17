"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { INVENTORY_STATUS_LABELS } from "@/lib/constants/categories";
import {
  createInventoryItem,
  updateInventoryStatus,
  deleteInventoryItem,
} from "@/lib/actions/inventory";
import { formatDate } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import type { InventoryStatus } from "@prisma/client";

interface InventoryRow {
  id: string;
  quantityOnHand: number;
  status: string;
  usageCount: number;
  acquiredAt: string;
  notes: string | null;
  product: { id: string; code: string; name: string };
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
}

interface InventoryPageClientProps {
  items: InventoryRow[];
  products: ProductOption[];
  currentStatus?: string;
}

export function InventoryPageClient({ items, products, currentStatus }: InventoryPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Add form state
  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newNotes, setNewNotes] = useState("");

  const statusFilters = ["ALL", ...Object.keys(INVENTORY_STATUS_LABELS)] as const;

  function handleStatusFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "ALL") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function handleStatusChange(id: string, status: InventoryStatus) {
    const result = await updateInventoryStatus(id, status);
    if (result.success) {
      toast.success("Estado actualizado");
    } else {
      toast.error(result.error);
    }
  }

  async function handleAdd() {
    if (!newProductId) {
      toast.error("Seleccione un producto");
      return;
    }
    setLoading(true);
    const result = await createInventoryItem({
      productId: newProductId,
      quantityOnHand: newQuantity,
      notes: newNotes || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Item agregado al inventario");
      setAddOpen(false);
      setNewProductId("");
      setNewQuantity(1);
      setNewNotes("");
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setLoading(true);
    const result = await deleteInventoryItem(deleteId);
    setLoading(false);
    if (result.success) {
      toast.success("Item eliminado del inventario");
      setDeleteId(null);
    } else {
      toast.error(result.error);
      setDeleteId(null);
    }
  }

  const columns: Column<InventoryRow>[] = [
    { key: "code", header: "Código", cell: (row) => <span className="font-medium">{row.product.code}</span> },
    { key: "name", header: "Producto", cell: (row) => row.product.name },
    { key: "quantity", header: "Cantidad", cell: (row) => row.quantityOnHand, className: "text-center" },
    {
      key: "status",
      header: "Estado",
      cell: (row) => (
        <Select
          value={row.status}
          onValueChange={(v) => handleStatusChange(row.id, v as InventoryStatus)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INVENTORY_STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    { key: "usage", header: "Usos", cell: (row) => row.usageCount, className: "text-center" },
    { key: "acquired", header: "Adquirido", cell: (row) => formatDate(row.acquiredAt) },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
      className: "w-10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchInput placeholder="Buscar por código o nombre..." />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Item
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((status) => (
          <Badge
            key={status}
            variant={(currentStatus ?? "ALL") === status ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => handleStatusFilter(status)}
          >
            {status === "ALL" ? "Todos" : INVENTORY_STATUS_LABELS[status]}
          </Badge>
        ))}
      </div>

      <DataTable columns={columns} data={items} emptyMessage="No hay items en inventario" />

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Item al Inventario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Producto *</Label>
              <Select value={newProductId} onValueChange={setNewProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input type="number" min={1} value={newQuantity} onChange={(e) => setNewQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Notas opcionales..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={loading}>
              {loading ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Eliminar item"
        description="¿Estás seguro de que deseas eliminar este item del inventario?"
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={loading}
      />
    </div>
  );
}
