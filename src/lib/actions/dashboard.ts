"use server";

import { prisma } from "@/lib/prisma";
import { toDecimalNumber } from "@/lib/utils";

export async function getDashboardData(startDate?: Date, endDate?: Date) {
  const now = new Date();
  const start = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    paymentsThisMonth,
    expensesThisMonth,
    completedOrders,
    pipelineOrders,
    upcomingEvents,
    recentPayments,
    inventorySummary,
    ordersByStatus,
    monthlyData,
  ] = await Promise.all([
    // Total revenue (payments received this month)
    prisma.payment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      select: { amount: true },
    }),

    // Total expenses this month
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      select: { amount: true },
    }),

    // Completed orders this month (profit recognized)
    prisma.order.findMany({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: start, lte: end },
      },
      select: { totalPrice: true, totalCost: true },
    }),

    // Orders in pipeline
    prisma.order.count({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),

    // Upcoming events (next 30 days)
    prisma.order.findMany({
      where: {
        eventDate: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { client: true },
      orderBy: { eventDate: "asc" },
      take: 10,
    }),

    // Recent payments
    prisma.payment.findMany({
      include: { order: { include: { client: true } } },
      orderBy: { paymentDate: "desc" },
      take: 10,
    }),

    // Inventory summary
    prisma.inventoryItem.groupBy({
      by: ["status"],
      _count: { status: true },
    }),

    // Orders by status
    prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
    }),

    // Monthly revenue & expenses (last 6 months)
    getMonthlyTrends(),
  ]);

  const totalRevenue = paymentsThisMonth.reduce(
    (sum, p) => sum + toDecimalNumber(p.amount),
    0
  );
  const totalExpenses = expensesThisMonth.reduce(
    (sum, e) => sum + toDecimalNumber(e.amount),
    0
  );
  const totalProfit = completedOrders.reduce(
    (sum, o) => sum + (toDecimalNumber(o.totalPrice) - toDecimalNumber(o.totalCost)),
    0
  );

  return {
    kpis: {
      totalRevenue,
      totalExpenses,
      netCashFlow: totalRevenue - totalExpenses,
      pipelineOrders,
      totalProfit,
    },
    upcomingEvents,
    recentPayments,
    inventorySummary: inventorySummary.map((g) => ({
      status: g.status,
      count: g._count.status,
    })),
    ordersByStatus: ordersByStatus.map((g) => ({
      status: g.status,
      count: g._count.status,
    })),
    monthlyData,
  };
}

async function getMonthlyTrends() {
  const months: { month: string; revenue: number; expenses: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const monthLabel = start.toLocaleDateString("es-CO", {
      month: "short",
      year: "numeric",
    });

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { paymentDate: { gte: start, lte: end } },
        select: { amount: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        select: { amount: true },
      }),
    ]);

    months.push({
      month: monthLabel,
      revenue: payments.reduce((s, p) => s + toDecimalNumber(p.amount), 0),
      expenses: expenses.reduce((s, e) => s + toDecimalNumber(e.amount), 0),
    });
  }

  return months;
}

export async function getTopProducts(limit = 5) {
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

  return products.map((p) => {
    const product = productDetails.find((d) => d.id === p.productId);
    return {
      code: product?.code ?? "",
      name: product?.name ?? "",
      revenue: toDecimalNumber(p._sum.unitPrice),
      orderCount: p._count.productId,
    };
  });
}
