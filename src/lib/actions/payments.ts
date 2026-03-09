"use server";

import { paymentSchema, type PaymentFormData } from "@/lib/validations/payment";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/payments/payments.service";
import { verifySession } from "@/lib/dal";
import * as auditRepo from "@/features/audit/audit.repo";

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
  const session = await verifySession();
  const parsed = paymentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createPayment(parsed.data, session.userId);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Payment",
      entityId: result.data.id,
      action: "PAYMENT_CREATED",
      newValue: String(parsed.data.amount),
      orderId: parsed.data.orderId,
      paymentId: result.data.id,
      userId: session.userId,
      metadata: {
        method: parsed.data.paymentMethod,
        type: parsed.data.paymentType,
      },
    });
    revalidatePath("/pagos");
    revalidatePath(`/pedidos/${parsed.data.orderId}`);
    revalidatePath("/pedidos");
  }
  return result;
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const session = await verifySession();
  const internal = await service.deletePayment(id);
  if (internal.success) {
    await auditRepo.createAuditLog({
      entity: "Payment",
      entityId: id,
      action: "DELETED",
      paymentId: id,
      orderId: internal.orderId,
      userId: session.userId,
    });
    revalidatePath("/pagos");
    revalidatePath(`/pedidos/${internal.orderId}`);
    return { success: true, data: undefined };
  }
  return { success: false, error: internal.error };
}
