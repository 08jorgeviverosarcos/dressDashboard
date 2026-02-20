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
  adjustmentAmount: number;
  adjustmentReason?: string;
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
          rental: { include: { costs: true } },
        },
      },
      payments: { orderBy: { paymentDate: "asc" } },
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
      adjustmentAmount: orderData.adjustmentAmount,
      adjustmentReason: orderData.adjustmentReason || null,
      minDownpaymentPct: orderData.minDownpaymentPct,
      notes: orderData.notes || null,
      status: "QUOTE",
      items: {
        create: items.map((item) => ({
          productId: item.productId || null,
          inventoryItemId: item.inventoryItemId || null,
          itemType: item.itemType,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: item.discountType || null,
          discountValue: item.discountValue ?? null,
          costSource: item.costSource,
          costAmount: item.costAmount,
          notes: item.notes || null,
        })),
      },
    },
    include: {
      items: true,
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
    // 1. Buscar items existentes con sus rentals
    const existingItems = await tx.orderItem.findMany({
      where: { orderId: id },
      include: { rental: true },
    });

    // 2. Borrar todos los items (Rental.orderItemId -> null por onDelete: SetNull)
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    // 3. Actualizar la orden y crear los nuevos items
    const updatedOrder = await tx.order.update({
      where: { id },
      data: {
        clientId: orderData.clientId,
        orderDate: orderData.orderDate,
        eventDate: orderData.eventDate ?? null,
        deliveryDate: orderData.deliveryDate ?? null,
        totalPrice: orderData.totalPrice,
        totalCost: orderData.totalCost,
        adjustmentAmount: orderData.adjustmentAmount,
        adjustmentReason: orderData.adjustmentReason || null,
        minDownpaymentPct: orderData.minDownpaymentPct,
        notes: orderData.notes || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId || null,
            inventoryItemId: item.inventoryItemId || null,
            itemType: item.itemType,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountType: item.discountType || null,
            discountValue: item.discountValue ?? null,
            costSource: item.costSource,
            costAmount: item.costAmount,
            notes: item.notes || null,
          })),
        },
      },
      include: { items: true },
    });

    // 4. Para items tipo RENTAL, re-asociar rentals existentes o crear nuevos
    const rentalItems = updatedOrder.items.filter((i) => i.itemType === "RENTAL");

    for (const newItem of rentalItems) {
      const formItem = items.find(
        (fi) => fi.itemType === "RENTAL" && fi.productId === newItem.productId
      );

      // Buscar rental huerfano que corresponda (por productId del item original)
      const matchingOldItem = existingItems.find(
        (ei) => ei.rental && ei.productId === newItem.productId
      );
      const orphanedRental = matchingOldItem?.rental;

      if (orphanedRental) {
        // Re-asociar el rental existente al nuevo item y actualizar fechas
        await tx.rental.update({
          where: { id: orphanedRental.id },
          data: {
            orderItemId: newItem.id,
            ...(formItem?.rentalReturnDate !== undefined && { returnDate: formItem.rentalReturnDate ?? null }),
          },
        });
      } else if (formItem) {
        // Crear nuevo rental
        await tx.rental.create({
          data: {
            orderItemId: newItem.id,
            returnDate: formItem.rentalReturnDate ?? null,
            deposit: 0,
          },
        });
      }
    }
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
    await tx.rental.deleteMany({ where: { orderItem: { is: { orderId: id } } } });
    await tx.order.delete({ where: { id } });
  });
}
