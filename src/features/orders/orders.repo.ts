import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";
import type { OrderItemFormData } from "@/lib/validations/order";

type OrderData = {
  clientId: string;
  orderDate: Date;
  eventDate?: Date | null;
  deliveryDate?: Date | null;
  totalPrice: number;
  totalCost: number;
  minDownpaymentPct: number;
  notes?: string;
};

export function findAll(filters?: { search?: string; status?: OrderStatus }) {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { client: { name: { contains: filters.search, mode: "insensitive" } } },
      { orderNumber: { equals: parseInt(filters.search) || -1 } },
    ];
  }

  return prisma.order.findMany({
    where,
    include: {
      client: true,
      payments: true,
      items: { include: { product: true } },
    },
    orderBy: { orderDate: "desc" },
  });
}

export function findById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: {
          product: true,
          inventoryItem: true,
          expenses: { orderBy: { date: "desc" } },
        },
      },
      payments: { orderBy: { paymentDate: "asc" } },
      rental: { include: { costs: true } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
}

export function findByIdSimple(id: string) {
  return prisma.order.findUnique({ where: { id } });
}

export function create(orderData: OrderData, items: OrderItemFormData[]) {
  return prisma.order.create({
    data: {
      clientId: orderData.clientId,
      orderDate: orderData.orderDate,
      eventDate: orderData.eventDate ?? null,
      deliveryDate: orderData.deliveryDate ?? null,
      totalPrice: orderData.totalPrice,
      totalCost: orderData.totalCost,
      minDownpaymentPct: orderData.minDownpaymentPct,
      notes: orderData.notes || null,
      status: "QUOTE",
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          inventoryItemId: item.inventoryItemId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costSource: item.costSource,
          costAmount: item.costAmount,
          notes: item.notes || null,
        })),
      },
    },
  });
}

export function createAuditLog(data: {
  entity: string;
  entityId: string;
  action: string;
  newValue: string;
  orderId: string;
}) {
  return prisma.auditLog.create({ data });
}

export function updateInTransaction(
  id: string,
  orderData: OrderData,
  items: OrderItemFormData[]
) {
  return prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    await tx.order.update({
      where: { id },
      data: {
        clientId: orderData.clientId,
        orderDate: orderData.orderDate,
        eventDate: orderData.eventDate ?? null,
        deliveryDate: orderData.deliveryDate ?? null,
        totalPrice: orderData.totalPrice,
        totalCost: orderData.totalCost,
        minDownpaymentPct: orderData.minDownpaymentPct,
        notes: orderData.notes || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            inventoryItemId: item.inventoryItemId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costSource: item.costSource,
            costAmount: item.costAmount,
            notes: item.notes || null,
          })),
        },
      },
    });
  });
}

export function updateStatusInTransaction(
  id: string,
  newStatus: OrderStatus,
  oldStatus: OrderStatus
) {
  return prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: { status: newStatus },
    }),
    prisma.auditLog.create({
      data: {
        entity: "Order",
        entityId: id,
        action: "STATUS_CHANGE",
        oldValue: oldStatus,
        newValue: newStatus,
        orderId: id,
      },
    }),
  ]);
}

export function deleteWithCascade(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { orderId: id } });
    const rental = await tx.rental.findUnique({ where: { orderId: id } });
    if (rental) {
      await tx.rental.delete({ where: { id: rental.id } });
    }
    await tx.order.delete({ where: { id } });
  });
}
