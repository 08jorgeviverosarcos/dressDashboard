import { toDecimalNumber } from "@/lib/utils";
import * as repo from "./dashboard.repo";

async function _getSalesMonthlyTrends() {
  const months: { month: string; sales: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const monthLabel = monthStart.toLocaleDateString("es-CO", {
      month: "short",
      year: "numeric",
    });

    const orders = await repo.getOrdersWithPaymentsByDateRange(monthStart, monthEnd);
    const sales = orders.reduce((s, o) => s + toDecimalNumber(o.totalPrice), 0);

    months.push({ month: monthLabel, sales });
  }

  return months;
}

async function _getMonthlyTrends() {
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
      repo.getPaymentsByDateRange(start, end),
      repo.getExpensesByDateRange(start, end),
    ]);

    months.push({
      month: monthLabel,
      revenue: payments.reduce((s, p) => s + toDecimalNumber(p.amount), 0),
      expenses: expenses.reduce((s, e) => s + toDecimalNumber(e.amount), 0),
    });
  }

  return months;
}

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
    ordersWithPayments,
    salesMonthlyData,
  ] = await Promise.all([
    repo.getPaymentsByDateRange(start, end),
    repo.getExpensesByDateRange(start, end),
    repo.getCompletedOrdersByDateRange(start, end),
    repo.getPipelineOrderCount(),
    repo.getUpcomingEvents(now, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
    repo.getRecentPayments(10),
    repo.getInventorySummary(),
    repo.getOrdersByStatus(),
    _getMonthlyTrends(),
    repo.getOrdersWithPaymentsByDateRange(start, end),
    _getSalesMonthlyTrends(),
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

  const totalSold = ordersWithPayments.reduce(
    (sum, o) => sum + toDecimalNumber(o.totalPrice),
    0
  );
  const totalPaidFromOrders = ordersWithPayments.reduce(
    (sum, o) => sum + o.payments.reduce((ps, p) => ps + toDecimalNumber(p.amount), 0),
    0
  );
  const totalPending = totalSold - totalPaidFromOrders;

  return {
    kpis: {
      totalRevenue,
      totalExpenses,
      netCashFlow: totalRevenue - totalExpenses,
      pipelineOrders,
      totalProfit,
      totalSold,
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
    salesSummary: { totalSold, totalPaid: totalPaidFromOrders, totalPending },
    salesMonthlyData,
  };
}

export async function getTopProducts(limit = 5) {
  const { products, productDetails } = await repo.getOrderItemRevenue(limit);

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
