import { prisma } from "@/lib/prisma";
import type { PaymentMethod, PaymentType } from "@prisma/client";

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
