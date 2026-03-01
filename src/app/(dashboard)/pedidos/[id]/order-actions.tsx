"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PaymentDialog } from "@/components/orders/PaymentDialog";
import { updateOrderStatus } from "@/lib/actions/orders";
import { ORDER_STATUS_LABELS } from "@/lib/constants/categories";
import { VALID_STATUS_TRANSITIONS } from "@/lib/business/status";
import type { OrderStatus } from "@prisma/client";
import { ChevronDown, CreditCard } from "lucide-react";

interface OrderActionsProps {
  orderId: string;
  currentStatus: OrderStatus;
  orderTotal: number;
  totalPaid: number;
}

export function OrderActions({ orderId, currentStatus, orderTotal, totalPaid }: OrderActionsProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];

  async function handleStatusChange() {
    if (!statusTarget) return;
    setLoading(true);
    const result = await updateOrderStatus(orderId, statusTarget);
    setLoading(false);
    if (result.success) {
      toast.success(`Estado actualizado a ${ORDER_STATUS_LABELS[statusTarget]}`);
      setStatusTarget(null);
    } else {
      toast.error(result.error);
      setStatusTarget(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button onClick={() => setPaymentOpen(true)}>
        <CreditCard className="mr-2 h-4 w-4" />
        Registrar Pago
      </Button>

      {validTransitions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Cambiar Estado
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {validTransitions.map((status) => (
              <DropdownMenuItem key={status} onClick={() => setStatusTarget(status)}>
                {ORDER_STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        orderId={orderId}
        orderTotal={orderTotal}
        totalPaid={totalPaid}
      />

      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title="Cambiar estado del pedido"
        description={`¿Cambiar estado a "${statusTarget ? ORDER_STATUS_LABELS[statusTarget] : ""}"?`}
        confirmLabel="Confirmar"
        onConfirm={handleStatusChange}
        loading={loading}
        variant={statusTarget === "CANCELLED" ? "destructive" : "default"}
      />
    </div>
  );
}
