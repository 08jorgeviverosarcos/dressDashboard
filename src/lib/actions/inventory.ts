"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { InventoryStatus } from "@prisma/client";

export async function getInventoryItems(filters?: {
  search?: string;
  status?: InventoryStatus;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.product = {
      OR: [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ],
    };
  }

  return prisma.inventoryItem.findMany({
    where,
    include: { product: true },
    orderBy: { product: { code: "asc" } },
  });
}

export async function createInventoryItem(data: {
  productId: string;
  quantityOnHand?: number;
  status?: InventoryStatus;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!data.productId) {
    return { success: false, error: "Seleccione un producto" };
  }

  const item = await prisma.inventoryItem.create({
    data: {
      productId: data.productId,
      quantityOnHand: data.quantityOnHand ?? 1,
      status: data.status ?? "AVAILABLE",
      notes: data.notes || null,
    },
  });

  revalidatePath("/inventario");
  return { success: true, data: { id: item.id } };
}

export async function updateInventoryStatus(
  id: string,
  status: InventoryStatus
): Promise<ActionResult> {
  await prisma.inventoryItem.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/inventario");
  return { success: true, data: undefined };
}

export async function updateInventoryItem(
  id: string,
  data: { quantityOnHand?: number; status?: InventoryStatus; notes?: string }
): Promise<ActionResult> {
  await prisma.inventoryItem.update({
    where: { id },
    data: {
      ...(data.quantityOnHand !== undefined && { quantityOnHand: data.quantityOnHand }),
      ...(data.status && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  revalidatePath("/inventario");
  return { success: true, data: undefined };
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  const linkedOrders = await prisma.orderItem.count({ where: { inventoryItemId: id } });
  if (linkedOrders > 0) {
    return { success: false, error: "Este item está vinculado a pedidos existentes" };
  }

  await prisma.inventoryItem.delete({ where: { id } });
  revalidatePath("/inventario");
  return { success: true, data: undefined };
}
