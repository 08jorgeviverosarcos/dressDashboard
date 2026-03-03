"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/rentals/rentals.service";

export async function getRental(orderItemId: string) {
  return service.getRental(orderItemId);
}

export async function createRental(data: {
  orderItemId: string;
  orderId: string;
  returnDate?: Date | null;
  deposit?: number;
}): Promise<ActionResult<{ id: string }>> {
  const result = await service.createRental(data);
  if (result.success) revalidatePath(`/pedidos/${data.orderId}`);
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
  const internal = await service.updateRental(id, data);
  if (internal.success) {
    revalidatePath(`/pedidos/${internal.orderId}`);
    revalidatePath("/inventario");
    return { success: true, data: undefined };
  }
  return { success: false, error: internal.error };
}
