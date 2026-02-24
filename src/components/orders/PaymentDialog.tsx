"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentFormData } from "@/lib/validations/payment";
import { createPayment } from "@/lib/actions/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/constants/categories";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderTotal: number;
  totalPaid: number;
}

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  orderTotal,
  totalPaid,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const remaining = orderTotal - totalPaid;

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      orderId,
      paymentDate: new Date(),
      amount: 0,
      paymentType: "INSTALLMENT",
      paymentMethod: "CASH",
      reference: "",
      notes: "",
    },
  });
  const amountValue = form.watch("amount");

  async function onSubmit(data: PaymentFormData) {
    setLoading(true);
    const result = await createPayment({ ...data, orderId });
    setLoading(false);

    if (result.success) {
      toast.success("Pago registrado exitosamente");
      form.reset();
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
        </DialogHeader>
        <div className="mb-4 rounded-lg bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <span>Total del pedido:</span>
            <span className="font-medium">${orderTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Pagado:</span>
            <span className="font-medium">${totalPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Restante:</span>
            <span>${remaining.toLocaleString()}</span>
          </div>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                {...form.register("paymentDate", { valueAsDate: true })}
              />
              {form.formState.errors.paymentDate && (
                <p className="text-sm text-destructive">{form.formState.errors.paymentDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <MoneyInput
                value={amountValue}
                placeholder="$0"
                onValueChange={(value) => {
                  form.setValue("amount", value ?? 0, { shouldDirty: true, shouldValidate: true });
                }}
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Pago</Label>
              <Select
                value={form.watch("paymentType")}
                onValueChange={(v) => form.setValue("paymentType", v as PaymentFormData["paymentType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select
                value={form.watch("paymentMethod")}
                onValueChange={(v) => form.setValue("paymentMethod", v as PaymentFormData["paymentMethod"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input placeholder="Número de transacción" {...form.register("reference")} />
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea placeholder="Notas adicionales" {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Registrar Pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
