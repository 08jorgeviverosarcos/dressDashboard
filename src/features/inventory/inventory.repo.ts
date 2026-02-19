import { prisma } from "@/lib/prisma";
import type { InventoryStatus } from "@prisma/client";

export function findAll(filters?: {
  search?: string;
  status?: InventoryStatus;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.product = {
      OR: [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ],
    };
  }

  return prisma.inventoryItem.findMany({
    where,
    include: { product: true },
    orderBy: { product: { code: "asc" } },
  });
}

export function create(data: {
  productId: string;
  quantityOnHand: number;
  status: InventoryStatus;
  notes: string | null;
}) {
  return prisma.inventoryItem.create({ data });
}

export function updateStatus(id: string, status: InventoryStatus) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { status },
  });
}

export function update(
  id: string,
  data: { quantityOnHand?: number; status?: InventoryStatus; notes?: string }
) {
  return prisma.inventoryItem.update({
    where: { id },
    data: {
      ...(data.quantityOnHand !== undefined && { quantityOnHand: data.quantityOnHand }),
      ...(data.status && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });
}

export function deleteById(id: string) {
  return prisma.inventoryItem.delete({ where: { id } });
}

export function countLinkedOrders(id: string) {
  return prisma.orderItem.count({ where: { inventoryItemId: id } });
}

export function findById(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: { product: true },
  });
}
