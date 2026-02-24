import { prisma } from "@/lib/prisma";

export function findByOrderItemId(orderItemId: string) {
  return prisma.rental.findFirst({
    where: { orderItemId },
    include: {
      costs: { where: { deletedAt: null }, orderBy: { type: "asc" } },
      orderItem: {
        include: {
          product: true,
          order: {
            include: {
              client: true,
              items: { where: { deletedAt: null }, include: { product: true, inventoryItem: true } },
            },
          },
        },
      },
    },
  });
}

export function findByOrderItemIdSimple(orderItemId: string) {
  return prisma.rental.findFirst({ where: { orderItemId } });
}

export function findById(id: string) {
  return prisma.rental.findFirst({
    where: { id },
    include: {
      orderItem: {
        include: {
          order: { include: { items: { where: { deletedAt: null }, include: { inventoryItem: true } } } },
        },
      },
    },
  });
}

export function create(data: {
  orderItemId?: string | null;
  returnDate: Date | null;
  deposit: number;
}) {
  return prisma.rental.create({ data });
}

export function update(
  id: string,
  data: {
    returnDate?: Date | null;
    actualReturnDate?: Date | null;
    deposit?: number;
  }
) {
  return prisma.rental.update({
    where: { id },
    data: {
      ...(data.returnDate !== undefined && { returnDate: data.returnDate }),
      ...(data.actualReturnDate !== undefined && { actualReturnDate: data.actualReturnDate }),
      ...(data.deposit !== undefined && { deposit: data.deposit }),
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
  return prisma.rental.findFirst({
    where: { id: rentalId },
    include: { orderItem: { include: { order: true } } },
  });
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
  return prisma.rentalCost.findFirst({
    where: { id },
    include: { rental: { include: { orderItem: { include: { order: true } } } } },
  });
}

export function deleteCost(id: string) {
  return prisma.rentalCost.update({ where: { id }, data: { deletedAt: new Date() } });
}
