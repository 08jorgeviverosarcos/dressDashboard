"use server";

import { prisma } from "@/lib/prisma";
import { paymentSchema, type PaymentFormData } from "@/lib/validations/payment";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import { calculatePaidAmount } from "@/lib/business/profit";
import { deriveStatusAfterPayment } from "@/lib/business/status";
import { toDecimalNumber } from "@/lib/utils";

export async function getPayments(filters?: {
  orderId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentMethod?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.orderId) where.orderId = filters.orderId;
  if (filters?.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters?.startDate || filters?.endDate) {
    where.paymentDate = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate }),
    };
  }

  return prisma.payment.findMany({
    where,
    include: { order: { include: { client: true } } },
    orderBy: { paymentDate: "desc" },
  });
}

export async function createPayment(data: PaymentFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = paymentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { payments: true },
  });

  if (!order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  const currentPaid = calculatePaidAmount(order.payments);
  const newTotalPaid = currentPaid + parsed.data.amount;
  const totalPrice = toDecimalNumber(order.totalPrice);

  if (newTotalPaid > totalPrice) {
    return {
      success: false,
      error: `El pago excede el total del pedido. Máximo a pagar: $${(totalPrice - currentPaid).toLocaleString()}`,
    };
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: parsed.data.orderId,
      paymentDate: parsed.data.paymentDate,
      amount: parsed.data.amount,
      paymentType: parsed.data.paymentType,
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
    },
  });

  // Auto-advance status
  const newStatus = deriveStatusAfterPayment(
    order.status,
    order.totalPrice,
    order.minDownpaymentPct,
    newTotalPaid
  );

  if (newStatus !== order.status) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: newStatus },
      }),
      prisma.auditLog.create({
        data: {
          entity: "Order",
          entityId: order.id,
          action: "STATUS_CHANGE",
          oldValue: order.status,
          newValue: newStatus,
          orderId: order.id,
          paymentId: payment.id,
          metadata: { trigger: "payment", amount: parsed.data.amount },
        },
      }),
    ]);
  }

  await prisma.auditLog.create({
    data: {
      entity: "Payment",
      entityId: payment.id,
      action: "PAYMENT_CREATED",
      newValue: String(parsed.data.amount),
      orderId: order.id,
      paymentId: payment.id,
      metadata: {
        method: parsed.data.paymentMethod,
        type: parsed.data.paymentType,
      },
    },
  });

  revalidatePath("/pagos");
  revalidatePath(`/pedidos/${order.id}`);
  revalidatePath("/pedidos");
  return { success: true, data: { id: payment.id } };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    return { success: false, error: "Pago no encontrado" };
  }

  await prisma.payment.delete({ where: { id } });

  revalidatePath("/pagos");
  revalidatePath(`/pedidos/${payment.orderId}`);
  return { success: true, data: undefined };
}
