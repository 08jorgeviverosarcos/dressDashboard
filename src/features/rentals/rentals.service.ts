import type { ActionResult } from "@/types";
import * as repo from "./rentals.repo";

export function getRental(orderItemId: string) {
  return repo.findByOrderItemId(orderItemId);
}

export async function createRental(data: {
  orderItemId: string;
  returnDate?: Date | null;
  deposit?: number;
}): Promise<ActionResult<{ id: string }>> {
  const existing = await repo.findByOrderItemIdSimple(data.orderItemId);
  if (existing) {
    return { success: false, error: "Este pedido ya tiene un alquiler asociado" };
  }

  const rental = await repo.create({
    orderItemId: data.orderItemId,
    returnDate: data.returnDate ?? null,
    deposit: data.deposit ?? 0,
  });

  return { success: true, data: { id: rental.id } };
}

type UpdateRentalResult =
  | { success: true; orderId: string }
  | { success: false; error: string };

export async function updateRental(
  id: string,
  data: {
    returnDate?: Date | null;
    actualReturnDate?: Date | null;
    deposit?: number;
  }
): Promise<UpdateRentalResult> {
  const rental = await repo.findById(id);

  if (!rental) {
    return { success: false, error: "Alquiler no encontrado" };
  }

  const orderItem = rental.orderItem;
  if (!orderItem?.orderId) {
    return { success: false, error: "Pedido no encontrado" };
  }
  const orderId = orderItem.orderId;

  if (data.actualReturnDate && !rental.actualReturnDate) {
    const currentOrderItem = orderItem.order.items.find((item) => item.id === orderItem.id);
    if (currentOrderItem?.inventoryItem) {
      await repo.updateInventoryItemOnReturn(currentOrderItem.inventoryItem.id);
    }
  }

  await repo.update(id, data);
  return { success: true, orderId };
}
