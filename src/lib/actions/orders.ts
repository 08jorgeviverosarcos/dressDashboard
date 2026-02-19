"use server";

import { orderSchema, type OrderFormData } from "@/lib/validations/order";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { OrderStatus } from "@prisma/client";
import * as service from "@/features/orders/orders.service";

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
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createOrder(parsed.data);
  if (result.success) revalidatePath("/pedidos");
  return result;
}

export async function updateOrder(id: string, data: OrderFormData): Promise<ActionResult> {
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateOrder(id, parsed.data);
  if (result.success) {
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${id}`);
  }
  return result;
}

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<ActionResult> {
  const result = await service.updateOrderStatus(id, newStatus);
  if (result.success) {
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${id}`);
  }
  return result;
}

export async function deleteOrder(id: string): Promise<ActionResult> {
  const result = await service.deleteOrder(id);
  if (result.success) revalidatePath("/pedidos");
  return result;
}
