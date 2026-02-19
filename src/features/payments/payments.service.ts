import type { ActionResult } from "@/types";
import type { PaymentFormData } from "@/lib/validations/payment";
import { calculatePaidAmount } from "@/lib/business/profit";
import { deriveStatusAfterPayment } from "@/lib/business/status";
import { toDecimalNumber } from "@/lib/utils";
import * as repo from "./payments.repo";

export function getPayments(filters?: {
  orderId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentMethod?: string;
  search?: string;
}) {
  return repo.findAll(filters);
}

export function getPayment(id: string) {
  return repo.findByIdWithOrder(id);
}

export async function createPayment(
  parsed: PaymentFormData
): Promise<ActionResult<{ id: string }>> {
  const order = await repo.findOrderWithPayments(parsed.orderId);

  if (!order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  const currentPaid = calculatePaidAmount(order.payments);
  const newTotalPaid = currentPaid + parsed.amount;
  const totalPrice = toDecimalNumber(order.totalPrice);

  if (newTotalPaid > totalPrice) {
    return {
      success: false,
      error: `El pago excede el total del pedido. Máximo a pagar: $${(totalPrice - currentPaid).toLocaleString()}`,
    };
  }

  const payment = await repo.createPayment({
    orderId: parsed.orderId,
    paymentDate: parsed.paymentDate,
    amount: parsed.amount,
    paymentType: parsed.paymentType,
    paymentMethod: parsed.paymentMethod,
    reference: parsed.reference || null,
    notes: parsed.notes || null,
  });

  const newStatus = deriveStatusAfterPayment(
    order.status,
    order.totalPrice,
    order.minDownpaymentPct,
    newTotalPaid
  );

  if (newStatus !== order.status) {
    await repo.updateOrderStatusAndCreateAuditLog(
      order.id,
      newStatus,
      order.status,
      payment.id,
      parsed.amount
    );
  }

  await repo.createPaymentAuditLog(
    payment.id,
    order.id,
    parsed.paymentMethod,
    parsed.paymentType,
    parsed.amount
  );

  return { success: true, data: { id: payment.id } };
}

type DeletePaymentResult =
  | { success: true; orderId: string }
  | { success: false; error: string };

export async function deletePayment(id: string): Promise<DeletePaymentResult> {
  const payment = await repo.findById(id);
  if (!payment) {
    return { success: false, error: "Pago no encontrado" };
  }

  await repo.deleteById(id);
  return { success: true, orderId: payment.orderId };
}
