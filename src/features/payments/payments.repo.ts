import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentMethod, PaymentType } from "@prisma/client";

export function findAll(filters?: {
  orderId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentMethod?: string;
  search?: string;
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
  if (filters?.search) {
    const asNumber = parseInt(filters.search);
    where.OR = [
      { order: { client: { name: { contains: filters.search, mode: "insensitive" } } } },
      ...(!isNaN(asNumber) ? [{ order: { orderNumber: { equals: asNumber } } }] : []),
    ];
  }

  return prisma.payment.findMany({
    where,
    include: { order: { include: { client: true } } },
    orderBy: { paymentDate: "desc" },
  });
}

export function findOrderWithPayments(orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId },
    include: { payments: { where: { deletedAt: null } } },
  });
}

export function createPayment(data: {
  orderId: string;
  paymentDate: Date;
  amount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  reference: string | null;
  notes: string | null;
}) {
  return prisma.payment.create({ data });
}

export function updateOrderStatusAndCreateAuditLog(
  orderId: string,
  newStatus: OrderStatus,
  oldStatus: OrderStatus,
  paymentId: string,
  amount: number
) {
  return prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    }),
    prisma.auditLog.create({
      data: {
        entity: "Order",
        entityId: orderId,
        action: "STATUS_CHANGE",
        oldValue: oldStatus,
        newValue: newStatus,
        orderId: orderId,
        paymentId: paymentId,
        metadata: { trigger: "payment", amount: amount },
      },
    }),
  ]);
}

export function createPaymentAuditLog(
  paymentId: string,
  orderId: string,
  method: PaymentMethod,
  type: PaymentType,
  amount: number
) {
  return prisma.auditLog.create({
    data: {
      entity: "Payment",
      entityId: paymentId,
      action: "PAYMENT_CREATED",
      newValue: String(amount),
      orderId: orderId,
      paymentId: paymentId,
      metadata: {
        method: method,
        type: type,
      },
    },
  });
}

export function findById(id: string) {
  return prisma.payment.findFirst({ where: { id } });
}

export function findByIdWithOrder(id: string) {
  return prisma.payment.findFirst({
    where: { id },
    include: { order: { include: { client: true } } },
  });
}

export function deleteById(id: string) {
  return prisma.payment.update({ where: { id }, data: { deletedAt: new Date() } });
}
