import { prisma } from "@/lib/prisma";

export function findByOrderItemId(orderItemId: string) {
  return prisma.rental.findFirst({
    where: { orderItemId },
    include: {
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
