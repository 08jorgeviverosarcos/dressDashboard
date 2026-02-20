"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteOrderItem } from "@/lib/actions/orders";

interface DeleteOrderItemButtonProps {
  orderItemId: string;
  itemName: string;
  orderId: string;
}

export function DeleteOrderItemButton({
  orderItemId,
  itemName,
  orderId,
}: DeleteOrderItemButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await deleteOrderItem(orderItemId);

    if (result.success) {
      toast.success("Item eliminado");
      router.push(`/pedidos/${orderId}`);
    } else {
      toast.error(result.error);
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        Eliminar
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Eliminar item"
        description={`¿Estás seguro de que deseas eliminar "${itemName}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={loading}
      />
    </>
  );
}
