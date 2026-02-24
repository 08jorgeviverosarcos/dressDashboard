import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";
import type { OrderItemFormData } from "@/lib/validations/order";

type OrderData = {
  orderNumber: number;
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
      payments: { where: { deletedAt: null } },
      items: { where: { deletedAt: null }, include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findById(id: string) {
  return prisma.order.findFirst({
    where: { id },
    include: {
      client: true,
      items: {
        where: { deletedAt: null },
        include: {
          product: true,
          inventoryItem: true,
          expenses: { where: { deletedAt: null }, orderBy: { date: "desc" } },
          rental: { include: { costs: { where: { deletedAt: null } } } },
        },
      },
      payments: { where: { deletedAt: null }, orderBy: { paymentDate: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
}

export function findByIdSimple(id: string) {
  return prisma.order.findFirst({ where: { id } });
}

export function create(orderData: OrderData, items: OrderItemFormData[]) {
  return prisma.order.create({
    data: {
      orderNumber: orderData.orderNumber,
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

    // 2. Null out orderItemId on rentals of old items explicitly
    // (onDelete: SetNull won't fire because soft-delete doesn't issue a real DB DELETE)
    const oldItemIds = existingItems.map((i) => i.id);
    if (oldItemIds.length > 0) {
      await tx.rental.updateMany({
        where: { orderItemId: { in: oldItemIds } },
        data: { orderItemId: null },
      });
    }

    // 3. Soft-delete old items explicitly
    await tx.orderItem.updateMany({ where: { orderId: id, deletedAt: null }, data: { deletedAt: new Date() } });

    // 4. Actualizar la orden y crear los nuevos items
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

    // 5. Para items tipo RENTAL, re-asociar rentals existentes o crear nuevos
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
            ...(formItem?.rentalDeposit !== undefined && { deposit: formItem.rentalDeposit ?? 0 }),
          },
        });
      } else if (formItem) {
        // Crear nuevo rental
        await tx.rental.create({
          data: {
            orderItemId: newItem.id,
            returnDate: formItem.rentalReturnDate ?? null,
            deposit: formItem.rentalDeposit ?? 0,
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
    // 1. Find orderItems for this order (middleware adds deletedAt: null)
    const orderItems = await tx.orderItem.findMany({ where: { orderId: id } });
    const orderItemIds = orderItems.map((i) => i.id);

    // 2. Soft-delete expenses linked to these orderItems
    if (orderItemIds.length > 0) {
      await tx.expense.updateMany({
        where: { orderItemId: { in: orderItemIds } },
        data: { deletedAt: new Date() },
      });
    }

    // 3. Find rentals linked to these orderItems (middleware adds deletedAt: null)
    const rentals = await tx.rental.findMany({
      where: { orderItemId: { in: orderItemIds } },
    });
    const rentalIds = rentals.map((r) => r.id);

    // 4. Soft-delete rentalCosts
    if (rentalIds.length > 0) {
      await tx.rentalCost.updateMany({
        where: { rentalId: { in: rentalIds } },
        data: { deletedAt: new Date() },
      });
    }

    // 5. Soft-delete rentals
    if (rentalIds.length > 0) {
      await tx.rental.updateMany({
        where: { id: { in: rentalIds } },
        data: { deletedAt: new Date() },
      });
    }

    // 6. Soft-delete payments
    await tx.payment.updateMany({ where: { orderId: id }, data: { deletedAt: new Date() } });

    // 7. Soft-delete orderItems
    if (orderItemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: orderItemIds } },
        data: { deletedAt: new Date() },
      });
    }

    // 8. Soft-delete the order
    await tx.order.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}

export function findOrderItemById(id: string) {
  return prisma.orderItem.findFirst({
    where: { id },
    include: {
      product: true,
      inventoryItem: true,
      expenses: { where: { deletedAt: null }, orderBy: { date: "desc" } },
      rental: { include: { costs: { where: { deletedAt: null }, orderBy: { type: "asc" } } } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          clientId: true,
        },
      },
    },
  });
}

export function findOrderItemForDeletion(id: string) {
  return prisma.orderItem.findFirst({
    where: { id },
    include: {
      rental: { select: { id: true } },
      order: {
        include: {
          items: { where: { deletedAt: null } },
        },
      },
    },
  });
}

export function updateOrderItemInTransaction(
  orderItemId: string,
  orderId: string,
  itemData: {
    productId: string | null;
    inventoryItemId: string | null;
    itemType: "SALE" | "RENTAL" | "SERVICE";
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    discountType: "FIXED" | "PERCENTAGE" | null;
    discountValue: number | null;
    costSource: "INVENTORY" | "EXPENSES" | "MANUAL";
    costAmount: number;
    notes: string | null;
  },
  rentalData: {
    returnDate: Date | null;
    deposit: number;
  } | null,
  newTotalPrice: number,
  newTotalCost: number
) {
  return prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: itemData,
    });
    await tx.order.update({
      where: { id: orderId },
      data: { totalPrice: newTotalPrice, totalCost: newTotalCost },
    });
    if (rentalData) {
      await tx.rental.upsert({
        where: { orderItemId: orderItemId },
        update: {
          returnDate: rentalData.returnDate,
          deposit: rentalData.deposit,
        },
        create: {
          orderItemId: orderItemId,
          returnDate: rentalData.returnDate,
          deposit: rentalData.deposit,
        },
      });
    }
  });
}

export function deleteOrderItemAndUpdateTotals(
  orderItemId: string,
  orderId: string,
  rentalId: string | null,
  newTotalPrice: number,
  newTotalCost: number
) {
  return prisma.$transaction(async (tx) => {
    // Soft-delete expenses linked to this orderItem
    await tx.expense.updateMany({
      where: { orderItemId },
      data: { deletedAt: new Date() },
    });

    if (rentalId) {
      // Soft-delete rentalCosts for this rental
      await tx.rentalCost.updateMany({
        where: { rentalId },
        data: { deletedAt: new Date() },
      });
      // Soft-delete the rental
      await tx.rental.update({ where: { id: rentalId }, data: { deletedAt: new Date() } });
    }

    // Soft-delete the orderItem
    await tx.orderItem.update({ where: { id: orderItemId }, data: { deletedAt: new Date() } });

    await tx.order.update({
      where: { id: orderId },
      data: { totalPrice: newTotalPrice, totalCost: newTotalCost },
    });
  });
}
