import { prisma } from "@/lib/prisma";

export function findByOrderId(orderId: string) {
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

export function findByOrderIdSimple(orderId: string) {
  return prisma.rental.findUnique({ where: { orderId } });
}

export function findById(id: string) {
  return prisma.rental.findUnique({
    where: { id },
    include: { order: { include: { items: { include: { inventoryItem: true } } } } },
  });
}

export function create(data: {
  orderId: string;
  pickupDate: Date | null;
  returnDate: Date | null;
  chargedIncome: number;
}) {
  return prisma.rental.create({ data });
}

export function update(
  id: string,
  data: {
    pickupDate?: Date | null;
    returnDate?: Date | null;
    actualReturnDate?: Date | null;
    chargedIncome?: number;
  }
) {
  return prisma.rental.update({
    where: { id },
    data: {
      ...(data.pickupDate !== undefined && { pickupDate: data.pickupDate }),
      ...(data.returnDate !== undefined && { returnDate: data.returnDate }),
      ...(data.actualReturnDate !== undefined && { actualReturnDate: data.actualReturnDate }),
      ...(data.chargedIncome !== undefined && { chargedIncome: data.chargedIncome }),
    },
  });
}

export function updateInventoryItemOnReturn(inventoryItemId: string) {
  return prisma.inventoryItem.update({
    where: { id: inventoryItemId },
    data: {
      usageCount: { increment: 1 },
      status: "AVAILABLE",
    },
  });
}

export function findRentalByIdSimple(rentalId: string) {
  return prisma.rental.findUnique({ where: { id: rentalId } });
}

export function createCost(data: {
  rentalId: string;
  type: string;
  amount: number;
  description: string | null;
}) {
  return prisma.rentalCost.create({ data });
}

export function findCostById(id: string) {
  return prisma.rentalCost.findUnique({
    where: { id },
    include: { rental: true },
  });
}

export function deleteCost(id: string) {
  return prisma.rentalCost.delete({ where: { id } });
}
