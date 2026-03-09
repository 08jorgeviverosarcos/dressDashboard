"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { InventoryStatus } from "@prisma/client";
import * as service from "@/features/inventory/inventory.service";
import { verifySession } from "@/lib/dal";
import * as auditRepo from "@/features/audit/audit.repo";

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
  const session = await verifySession();
  const result = await service.createInventoryItem(data);
  if (result.success) {
    for (const id of result.data.ids) {
      await auditRepo.createAuditLog({
        entity: "InventoryItem",
        entityId: id,
        action: "CREATED",
        userId: session.userId,
        newValue: JSON.stringify(data),
      });
    }
    revalidatePath("/inventario");
  }
  return result;
}

export async function getAvailableUnitInventoryItems() {
  return service.getAvailableUnitInventoryItems();
}

export async function updateInventoryStatus(
  id: string,
  status: InventoryStatus
): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.updateInventoryStatus(id, status);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "InventoryItem",
      entityId: id,
      action: "STATUS_CHANGE",
      userId: session.userId,
      newValue: status,
    });
    revalidatePath("/inventario");
  }
  return result;
}

export async function updateInventoryItem(
  id: string,
  data: { quantityOnHand?: number; status?: InventoryStatus; notes?: string }
): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.updateInventoryItem(id, data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "InventoryItem",
      entityId: id,
      action: "UPDATED",
      userId: session.userId,
      newValue: JSON.stringify(data),
    });
    revalidatePath("/inventario");
  }
  return result;
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.deleteInventoryItem(id);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "InventoryItem",
      entityId: id,
      action: "DELETED",
      userId: session.userId,
    });
    revalidatePath("/inventario");
  }
  return result;
}

export async function getInventoryItem(id: string) {
  return service.getInventoryItem(id);
}
