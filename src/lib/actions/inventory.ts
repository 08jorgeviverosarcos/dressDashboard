"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { InventoryStatus } from "@prisma/client";
import * as service from "@/features/inventory/inventory.service";

export async function getInventoryItems(filters?: {
  search?: string;
  status?: InventoryStatus;
}) {
  return service.getInventoryItems(filters);
}

export async function createInventoryItem(data: {
  productId: string;
  inventoryTracking: "UNIT" | "QUANTITY";
  unitCount?: number;
  quantityOnHand?: number;
  notes?: string;
}): Promise<ActionResult<{ ids: string[] }>> {
  const result = await service.createInventoryItem(data);
  if (result.success) revalidatePath("/inventario");
  return result;
}

export async function getAvailableUnitInventoryItems() {
  return service.getAvailableUnitInventoryItems();
}

export async function updateInventoryStatus(
  id: string,
  status: InventoryStatus
): Promise<ActionResult> {
  const result = await service.updateInventoryStatus(id, status);
  if (result.success) revalidatePath("/inventario");
  return result;
}

export async function updateInventoryItem(
  id: string,
  data: { quantityOnHand?: number; status?: InventoryStatus; notes?: string }
): Promise<ActionResult> {
  const result = await service.updateInventoryItem(id, data);
  if (result.success) revalidatePath("/inventario");
  return result;
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  const result = await service.deleteInventoryItem(id);
  if (result.success) revalidatePath("/inventario");
  return result;
}

export async function getInventoryItem(id: string) {
  return service.getInventoryItem(id);
}
