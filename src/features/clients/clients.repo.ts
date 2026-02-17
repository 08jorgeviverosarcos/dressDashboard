import { prisma } from "@/lib/prisma";

export function findAll(search?: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  return prisma.client.findMany({
    where,
    include: { orders: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
}

export function findById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        include: { payments: true },
        orderBy: { orderDate: "desc" },
      },
    },
  });
}

export function create(data: {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}) {
  return prisma.client.create({ data });
}

export function update(
  id: string,
  data: {
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
  }
) {
  return prisma.client.update({ where: { id }, data });
}

export function deleteById(id: string) {
  return prisma.client.delete({ where: { id } });
}

export function countOrders(clientId: string) {
  return prisma.order.count({ where: { clientId } });
}
