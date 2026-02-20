"use server";

import { rentalCostSchema, type RentalCostFormData } from "@/lib/validations/rental";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/rentals/rentals.service";

export async function getRental(orderItemId: string) {
  return service.getRental(orderItemId);
}

export async function createRental(data: {
  orderItemId: string;
  orderId: string;
  pickupDate?: Date | null;
  returnDate?: Date | null;
  chargedIncome?: number;
}): Promise<ActionResult<{ id: string }>> {
  const result = await service.createRental(data);
  if (result.success) revalidatePath(`/pedidos/${data.orderId}`);
  return result;
}

export async function updateRental(
  id: string,
  data: {
    pickupDate?: Date | null;
    returnDate?: Date | null;
    actualReturnDate?: Date | null;
    chargedIncome?: number;
  }
): Promise<ActionResult> {
  const internal = await service.updateRental(id, data);
  if (internal.success) {
    revalidatePath(`/pedidos/${internal.orderId}`);
    revalidatePath("/inventario");
    return { success: true, data: undefined };
  }
  return { success: false, error: internal.error };
}

export async function addRentalCost(data: RentalCostFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = rentalCostSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const internal = await service.addRentalCost(parsed.data);
  if (internal.success) {
    revalidatePath(`/pedidos/${internal.orderId}`);
    return { success: true, data: { id: internal.costId } };
  }
  return { success: false, error: internal.error };
}

export async function deleteRentalCost(id: string): Promise<ActionResult> {
  const internal = await service.deleteRentalCost(id);
  if (internal.success) {
    revalidatePath(`/pedidos/${internal.orderId}`);
    return { success: true, data: undefined };
  }
  return { success: false, error: internal.error };
}
