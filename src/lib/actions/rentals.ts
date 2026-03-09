"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/rentals/rentals.service";
import { verifySession } from "@/lib/dal";
import * as auditRepo from "@/features/audit/audit.repo";

export async function getRental(orderItemId: string) {
  return service.getRental(orderItemId);
}

export async function createRental(data: {
  orderItemId: string;
  orderId: string;
  returnDate?: Date | null;
  deposit?: number;
}): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  const result = await service.createRental(data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Rental",
      entityId: result.data.id,
      action: "CREATED",
      userId: session.userId,
      orderId: data.orderId,
    });
    revalidatePath(`/pedidos/${data.orderId}`);
  }
  return result;
}

export async function updateRental(
  id: string,
  data: {
    returnDate?: Date | null;
    actualReturnDate?: Date | null;
    deposit?: number;
  }
): Promise<ActionResult> {
  const session = await verifySession();
  const internal = await service.updateRental(id, data);
  if (internal.success) {
    await auditRepo.createAuditLog({
      entity: "Rental",
      entityId: id,
      action: "UPDATED",
      userId: session.userId,
      orderId: internal.orderId,
      newValue: JSON.stringify(data),
    });
    revalidatePath(`/pedidos/${internal.orderId}`);
    revalidatePath("/inventario");
    return { success: true, data: undefined };
  }
  return { success: false, error: internal.error };
}
