import { prisma } from "@/lib/prisma";
import type { Prisma, ProductType } from "@prisma/client";

export function findAll(filters?: {
  search?: string;
  type?: ProductType;
  categoryId?: string;
}) {
  const where: Record<string, unknown> = { isActive: true };

  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters?.type) where.type = filters.type;
  if (filters?.categoryId) where.categoryId = filters.categoryId;

  return prisma.product.findMany({
    where,
    include: { inventoryItems: { where: { deletedAt: null } }, category: true },
    orderBy: { code: "asc" },
  });
}

export function findById(id: string) {
  return prisma.product.findFirst({
    where: { id },
    include: {
      category: true,
      inventoryItems: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      orderItems: {
        where: { deletedAt: null },
        include: { order: { include: { client: true } } },
        orderBy: { order: { orderDate: "desc" } },
        take: 10,
      },
    },
  });
}

export function findByCode(code: string) {
  return prisma.product.findFirst({ where: { code } });
}

export function findByCodeExcluding(code: string, excludeId: string) {
  return prisma.product.findFirst({ where: { code, NOT: { id: excludeId } } });
}

export function create(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data });
}

export function update(id: string, data: Prisma.ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data });
}
