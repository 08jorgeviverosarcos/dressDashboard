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
    orderBy: { createdAt: "desc" },
  });
}

export function create(data: {
  productId: string;
  assetCode?: string | null;
  quantityOnHand: number;
  status: InventoryStatus;
  notes: string | null;
}) {
  return prisma.inventoryItem.create({ data });
}

export function createMany(
  items: Array<{
    productId: string;
    assetCode: string | null;
    quantityOnHand: number;
    status: InventoryStatus;
    notes: string | null;
  }>
) {
  return prisma.$transaction(
    items.map((item) => prisma.inventoryItem.create({ data: item }))
  );
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

// Fixed: soft delete instead of hard delete
export function deleteById(id: string) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export function countLinkedOrders(id: string) {
  return prisma.orderItem.count({ where: { inventoryItemId: id } });
}

// Fixed: findFirst instead of findUnique (respects soft-delete extension)
export function findById(id: string) {
  return prisma.inventoryItem.findFirst({
    where: { id },
    include: { product: true },
  });
}

// Get existing assetCodes for a product (for suffix calculation)
export function findAssetCodesByProductId(productId: string) {
  return prisma.inventoryItem.findMany({
    where: { productId },
    select: { assetCode: true },
  });
}

// Get AVAILABLE UNIT inventory items (for order item selector)
export function findAvailableUnitItems() {
  return prisma.inventoryItem.findMany({
    where: {
      status: "AVAILABLE",
      product: { inventoryTracking: "UNIT" },
    },
    include: { product: true },
    orderBy: { assetCode: "asc" },
  });
}

// Adjust quantityOnHand by delta (positive = increment, negative = decrement)
export function adjustQuantityOnHand(id: string, delta: number) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { quantityOnHand: { increment: delta } },
  });
}
