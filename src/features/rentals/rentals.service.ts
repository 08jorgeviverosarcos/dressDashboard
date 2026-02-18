import type { ActionResult } from "@/types";
import type { RentalCostFormData } from "@/lib/validations/rental";
import * as repo from "./rentals.repo";

export function getRental(orderId: string) {
  return repo.findByOrderId(orderId);
}

export async function createRental(data: {
  orderId: string;
  pickupDate?: Date | null;
  returnDate?: Date | null;
  chargedIncome?: number;
}): Promise<ActionResult<{ id: string }>> {
  const existing = await repo.findByOrderIdSimple(data.orderId);
  if (existing) {
    return { success: false, error: "Este pedido ya tiene un alquiler asociado" };
  }

  const rental = await repo.create({
    orderId: data.orderId,
    pickupDate: data.pickupDate ?? null,
    returnDate: data.returnDate ?? null,
    chargedIncome: data.chargedIncome ?? 0,
  });

  return { success: true, data: { id: rental.id } };
}

type UpdateRentalResult =
  | { success: true; orderId: string }
  | { success: false; error: string };

export async function updateRental(
  id: string,
  data: {
    pickupDate?: Date | null;
    returnDate?: Date | null;
    actualReturnDate?: Date | null;
    chargedIncome?: number;
  }
): Promise<UpdateRentalResult> {
  const rental = await repo.findById(id);

  if (!rental) {
    return { success: false, error: "Alquiler no encontrado" };
  }

  if (data.actualReturnDate && !rental.actualReturnDate) {
    for (const item of rental.order.items) {
      if (item.inventoryItem) {
        await repo.updateInventoryItemOnReturn(item.inventoryItem.id);
      }
    }
  }

  await repo.update(id, data);
  return { success: true, orderId: rental.orderId };
}

type AddRentalCostResult =
  | { success: true; costId: string; orderId: string }
  | { success: false; error: string };

export async function addRentalCost(
  parsed: RentalCostFormData
): Promise<AddRentalCostResult> {
  const rental = await repo.findRentalByIdSimple(parsed.rentalId);
  if (!rental) {
    return { success: false, error: "Alquiler no encontrado" };
  }

  const cost = await repo.createCost({
    rentalId: parsed.rentalId,
    type: parsed.type,
    amount: parsed.amount,
    description: parsed.description || null,
  });

  return { success: true, costId: cost.id, orderId: rental.orderId };
}

type DeleteRentalCostResult =
  | { success: true; orderId: string }
  | { success: false; error: string };

export async function deleteRentalCost(id: string): Promise<DeleteRentalCostResult> {
  const cost = await repo.findCostById(id);
  if (!cost) {
    return { success: false, error: "Costo no encontrado" };
  }

  await repo.deleteCost(id);
  return { success: true, orderId: cost.rental.orderId };
}
