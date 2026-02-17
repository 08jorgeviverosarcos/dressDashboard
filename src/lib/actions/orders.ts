"use server";

import { prisma } from "@/lib/prisma";
import { orderSchema, type OrderFormData } from "@/lib/validations/order";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { OrderStatus } from "@prisma/client";
import { canTransitionTo } from "@/lib/business/status";

export async function getOrders(filters?: {
  search?: string;
  status?: OrderStatus;
}) {
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

export async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      items: { include: { product: true, inventoryItem: true } },
      payments: { orderBy: { paymentDate: "asc" } },
      expenses: { orderBy: { date: "desc" } },
      rental: { include: { costs: true } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createOrder(data: OrderFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { items, ...orderData } = parsed.data;

  const order = await prisma.order.create({
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

  await prisma.auditLog.create({
    data: {
      entity: "Order",
      entityId: order.id,
      action: "CREATED",
      newValue: "QUOTE",
      orderId: order.id,
    },
  });

  revalidatePath("/pedidos");
  return { success: true, data: { id: order.id } };
}

export async function updateOrder(id: string, data: OrderFormData): Promise<ActionResult> {
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { items, ...orderData } = parsed.data;

  await prisma.$transaction(async (tx) => {
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

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
  return { success: true, data: undefined };
}

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<ActionResult> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  if (!canTransitionTo(order.status, newStatus)) {
    return {
      success: false,
      error: `No se puede cambiar de ${order.status} a ${newStatus}`,
    };
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: { status: newStatus },
    }),
    prisma.auditLog.create({
      data: {
        entity: "Order",
        entityId: id,
        action: "STATUS_CHANGE",
        oldValue: order.status,
        newValue: newStatus,
        orderId: id,
      },
    }),
  ]);

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
  return { success: true, data: undefined };
}
