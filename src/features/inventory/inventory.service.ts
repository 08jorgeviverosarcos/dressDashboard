import type { ActionResult } from "@/types";
import type { InventoryStatus } from "@prisma/client";
import * as repo from "./inventory.repo";

export function getInventoryItems(filters?: {
  search?: string;
  status?: InventoryStatus;
}) {
  return repo.findAll(filters);
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

  const item = await repo.create({
    productId: data.productId,
    quantityOnHand: data.quantityOnHand ?? 1,
    status: data.status ?? "AVAILABLE",
    notes: data.notes || null,
  });

  return { success: true, data: { id: item.id } };
}

export async function updateInventoryStatus(
  id: string,
  status: InventoryStatus
): Promise<ActionResult> {
  await repo.updateStatus(id, status);
  return { success: true, data: undefined };
}

export async function updateInventoryItem(
  id: string,
  data: { quantityOnHand?: number; status?: InventoryStatus; notes?: string }
): Promise<ActionResult> {
  await repo.update(id, data);
  return { success: true, data: undefined };
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  const linkedOrders = await repo.countLinkedOrders(id);
  if (linkedOrders > 0) {
    return { success: false, error: "Este item está vinculado a pedidos existentes" };
  }

  await repo.deleteById(id);
  return { success: true, data: undefined };
}

export function getInventoryItem(id: string) {
  return repo.findById(id);
}
