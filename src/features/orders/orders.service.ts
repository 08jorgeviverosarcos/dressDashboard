import type { ActionResult } from "@/types";
import type { OrderFormData } from "@/lib/validations/order";
import type { OrderStatus } from "@prisma/client";
import { canTransitionTo } from "@/lib/business/status";
import * as repo from "./orders.repo";

export function getOrders(filters?: { search?: string; status?: OrderStatus }) {
  return repo.findAll(filters);
}

export function getOrder(id: string) {
  return repo.findById(id);
}

export async function createOrder(
  parsed: OrderFormData
): Promise<ActionResult<{ id: string }>> {
  const { items, ...orderData } = parsed;

  const order = await repo.create(orderData, items);

  await repo.createAuditLog({
    entity: "Order",
    entityId: order.id,
    action: "CREATED",
    newValue: "QUOTE",
    orderId: order.id,
  });

  return { success: true, data: { id: order.id } };
}

export async function updateOrder(
  id: string,
  parsed: OrderFormData
): Promise<ActionResult> {
  const { items, ...orderData } = parsed;

  await repo.updateInTransaction(id, orderData, items);

  return { success: true, data: undefined };
}

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<ActionResult> {
  const order = await repo.findByIdSimple(id);
  if (!order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  if (!canTransitionTo(order.status, newStatus)) {
    return {
      success: false,
      error: `No se puede cambiar de ${order.status} a ${newStatus}`,
    };
  }

  await repo.updateStatusInTransaction(id, newStatus, order.status);

  return { success: true, data: undefined };
}
