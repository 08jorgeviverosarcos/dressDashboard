import { prisma } from "@/lib/prisma";

export function findAll() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export function findById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: { products: { where: { isActive: true } } },
  });
}

export function findByCode(code: string) {
  return prisma.category.findUnique({ where: { code } });
}

export function findByCodeExcluding(code: string, excludeId: string) {
  return prisma.category.findFirst({ where: { code, NOT: { id: excludeId } } });
}

export function create(data: { name: string; code: string }) {
  return prisma.category.create({
    data: {
      name: data.name,
      code: data.code,
    },
  });
}

export function update(id: string, data: { name: string; code: string }) {
  return prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
    },
  });
}

export function deleteById(id: string) {
  return prisma.category.delete({ where: { id } });
}

export function countActiveProducts(categoryId: string) {
  return prisma.product.count({ where: { categoryId, isActive: true } });
}
