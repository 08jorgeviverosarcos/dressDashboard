"use server";

import { prisma } from "@/lib/prisma";
import { rentalCostSchema, type RentalCostFormData } from "@/lib/validations/rental";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function getRental(orderId: string) {
  return prisma.rental.findUnique({
    where: { orderId },
    include: {
      costs: { orderBy: { type: "asc" } },
      order: {
        include: {
          client: true,
          items: { include: { product: true, inventoryItem: true } },
        },
      },
    },
  });
}

export async function createRental(data: {
  orderId: string;
  pickupDate?: Date | null;
  returnDate?: Date | null;
  chargedIncome?: number;
}): Promise<ActionResult<{ id: string }>> {
  const existing = await prisma.rental.findUnique({ where: { orderId: data.orderId } });
  if (existing) {
    return { success: false, error: "Este pedido ya tiene un alquiler asociado" };
  }

  const rental = await prisma.rental.create({
    data: {
      orderId: data.orderId,
      pickupDate: data.pickupDate ?? null,
      returnDate: data.returnDate ?? null,
      chargedIncome: data.chargedIncome ?? 0,
    },
  });

  revalidatePath(`/pedidos/${data.orderId}`);
  return { success: true, data: { id: rental.id } };
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
  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { order: { include: { items: { include: { inventoryItem: true } } } } },
  });

  if (!rental) {
    return { success: false, error: "Alquiler no encontrado" };
  }

  // If setting actual return date, increment usage count on inventory items
  if (data.actualReturnDate && !rental.actualReturnDate) {
    for (const item of rental.order.items) {
      if (item.inventoryItem) {
        await prisma.inventoryItem.update({
          where: { id: item.inventoryItem.id },
          data: {
            usageCount: { increment: 1 },
            status: "AVAILABLE",
          },
        });
      }
    }
  }

  await prisma.rental.update({
    where: { id },
    data: {
      ...(data.pickupDate !== undefined && { pickupDate: data.pickupDate }),
      ...(data.returnDate !== undefined && { returnDate: data.returnDate }),
      ...(data.actualReturnDate !== undefined && { actualReturnDate: data.actualReturnDate }),
      ...(data.chargedIncome !== undefined && { chargedIncome: data.chargedIncome }),
    },
  });

  revalidatePath(`/pedidos/${rental.orderId}`);
  revalidatePath("/inventario");
  return { success: true, data: undefined };
}

export async function addRentalCost(data: RentalCostFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = rentalCostSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const rental = await prisma.rental.findUnique({ where: { id: parsed.data.rentalId } });
  if (!rental) {
    return { success: false, error: "Alquiler no encontrado" };
  }

  const cost = await prisma.rentalCost.create({
    data: {
      rentalId: parsed.data.rentalId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description || null,
    },
  });

  revalidatePath(`/pedidos/${rental.orderId}`);
  return { success: true, data: { id: cost.id } };
}

export async function deleteRentalCost(id: string): Promise<ActionResult> {
  const cost = await prisma.rentalCost.findUnique({
    where: { id },
    include: { rental: true },
  });
  if (!cost) {
    return { success: false, error: "Costo no encontrado" };
  }

  await prisma.rentalCost.delete({ where: { id } });
  revalidatePath(`/pedidos/${cost.rental.orderId}`);
  return { success: true, data: undefined };
}
