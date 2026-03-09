"use server";

import { orderSchema, orderItemSchema, type OrderFormData } from "@/lib/validations/order";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { OrderStatus } from "@prisma/client";
import * as service from "@/features/orders/orders.service";
import { verifySession } from "@/lib/dal";
import * as auditRepo from "@/features/audit/audit.repo";

// Pattern: translate expected persistence failures into ActionResult user messages.
// This keeps UI flows stable and avoids uncaught exceptions in form submits.
function mapCreateOrderPersistenceError(error: unknown): string {
  const duplicateOrderNumberMessage =
    "Ya existe un pedido con ese numero. Ingresa otro numero.";
  const genericCreateOrderMessage =
    "No se pudo crear el pedido. Intenta nuevamente.";

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  ) {
    // Prisma P2002 may expose target as array, string, or omit it depending on runtime/adapter.
    const target =
      "meta" in error &&
      typeof (error as { meta?: unknown }).meta === "object" &&
      (error as { meta?: { target?: unknown } }).meta?.target;

    if (Array.isArray(target) && target.some((value) => String(value).includes("orderNumber"))) {
      return duplicateOrderNumberMessage;
    }

    if (typeof target === "string" && target.includes("orderNumber")) {
      return duplicateOrderNumberMessage;
    }

    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      const message = (error as { message: string }).message;
      if (message.includes("orderNumber") || message.includes("Order_orderNumber_key")) {
        return duplicateOrderNumberMessage;
      }
    }

    return duplicateOrderNumberMessage;
  }

  return genericCreateOrderMessage;
}

export async function getOrders(filters?: {
  search?: string;
  status?: OrderStatus;
}) {
  return service.getOrders(filters);
}

export async function getOrder(id: string) {
  return service.getOrder(id);
}

export async function createOrder(data: OrderFormData): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const result = await service.createOrder(parsed.data);
    if (result.success) {
      await auditRepo.createAuditLog({
        entity: "Order",
        entityId: result.data.id,
        action: "CREATED",
        newValue: "QUOTE",
        orderId: result.data.id,
        userId: session.userId,
      });
      revalidatePath("/pedidos");
    }
    return result;
  } catch (error) {
    return { success: false, error: mapCreateOrderPersistenceError(error) };
  }
}

export async function updateOrder(id: string, data: OrderFormData): Promise<ActionResult> {
  const session = await verifySession();
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateOrder(id, parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Order",
      entityId: id,
      action: "UPDATED",
      orderId: id,
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${id}`);
  }
  return result;
}

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.updateOrderStatus(id, newStatus, session.userId);
  if (result.success) {
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${id}`);
  }
  return result;
}

export async function deleteOrder(id: string): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.deleteOrder(id);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Order",
      entityId: id,
      action: "DELETED",
      orderId: id,
      userId: session.userId,
    });
    revalidatePath("/pedidos");
  }
  return result;
}

export async function getOrderItem(id: string) {
  return service.getOrderItem(id);
}

export async function deleteOrderItem(id: string): Promise<ActionResult<{ orderId: string }>> {
  const session = await verifySession();
  const result = await service.deleteOrderItem(id);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "OrderItem",
      entityId: id,
      action: "DELETED",
      orderId: result.data.orderId,
      userId: session.userId,
    });
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${result.data.orderId}`);
  }
  return result;
}

export async function updateOrderItem(
  id: string,
  data: unknown
): Promise<ActionResult<{ orderId: string }>> {
  const session = await verifySession();
  const parsed = orderItemSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateOrderItem(id, parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "OrderItem",
      entityId: id,
      action: "UPDATED",
      orderId: result.data.orderId,
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${result.data.orderId}`);
  }
  return result;
}
