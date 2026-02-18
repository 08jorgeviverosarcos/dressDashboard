import { prisma } from "@/lib/prisma";

export function getPaymentsByDateRange(start: Date, end: Date) {
  return prisma.payment.findMany({
    where: { paymentDate: { gte: start, lte: end } },
    select: { amount: true },
  });
}

export function getExpensesByDateRange(start: Date, end: Date) {
  return prisma.expense.findMany({
    where: { date: { gte: start, lte: end } },
    select: { amount: true },
  });
}

export function getCompletedOrdersByDateRange(start: Date, end: Date) {
  return prisma.order.findMany({
    where: {
      status: "COMPLETED",
      updatedAt: { gte: start, lte: end },
    },
    select: { totalPrice: true, totalCost: true },
  });
}

export function getPipelineOrderCount() {
  return prisma.order.count({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
  });
}

export function getUpcomingEvents(from: Date, to: Date) {
  return prisma.order.findMany({
    where: {
      eventDate: {
        gte: from,
        lte: to,
      },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    include: { client: true },
    orderBy: { eventDate: "asc" },
    take: 10,
  });
}

export function getRecentPayments(limit: number) {
  return prisma.payment.findMany({
    include: { order: { include: { client: true } } },
    orderBy: { paymentDate: "desc" },
    take: limit,
  });
}

export function getInventorySummary() {
  return prisma.inventoryItem.groupBy({
    by: ["status"],
    _count: { status: true },
  });
}

export function getOrdersByStatus() {
  return prisma.order.groupBy({
    by: ["status"],
    _count: { status: true },
  });
}

export async function getOrderItemRevenue(limit: number) {
  const products = await prisma.orderItem.groupBy({
    by: ["productId"],
    _sum: { unitPrice: true },
    _count: { productId: true },
    orderBy: { _sum: { unitPrice: "desc" } },
    take: limit,
  });

  const productDetails = await prisma.product.findMany({
    where: { id: { in: products.map((p) => p.productId) } },
  });

  return { products, productDetails };
}
