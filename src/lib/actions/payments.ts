"use server";

import { paymentSchema, type PaymentFormData } from "@/lib/validations/payment";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/payments/payments.service";

export async function getPayments(filters?: {
  orderId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentMethod?: string;
  search?: string;
}) {
  return service.getPayments(filters);
}

export async function getPayment(id: string) {
  return service.getPayment(id);
}

export async function createPayment(data: PaymentFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = paymentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createPayment(parsed.data);
  if (result.success) {
    revalidatePath("/pagos");
    revalidatePath(`/pedidos/${parsed.data.orderId}`);
    revalidatePath("/pedidos");
  }
  return result;
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const internal = await service.deletePayment(id);
  if (internal.success) {
    revalidatePath("/pagos");
    revalidatePath(`/pedidos/${internal.orderId}`);
    return { success: true, data: undefined };
  }
  return { success: false, error: internal.error };
}
