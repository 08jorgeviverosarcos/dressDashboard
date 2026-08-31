import { calculateItemSubtotal, calculateOrderBalance } from "@/lib/business/profit";
import { toDecimalNumber } from "@/lib/utils";
import * as repo from "./dashboard.repo";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TREND_MONTHS = 6;
const UPCOMING_EVENT_LIMIT = 10;

/**
 * Las fechas se guardan como medianoche local de Colombia (05:00 UTC) y toda la
 * UI las formatea en UTC, así que los cortes de rango también se construyen en
 * UTC para que el resultado no dependa de la zona horaria del servidor.
 */
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

function startOfUtcMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

function endOfUtcMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

const MONTH_ABBREVIATIONS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function monthLabel(date: Date): string {
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${MONTH_ABBREVIATIONS[date.getUTCMonth()]} ${year}`;
}

function daysBetweenUtc(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY);
}

function sumAmounts(rows: { amount: unknown }[]): number {
  return rows.reduce((sum, row) => sum + toDecimalNumber(row.amount), 0);
}

function groupAmountsBy<T extends { amount: unknown }>(
  rows: T[],
  key: (row: T) => string
): { name: string; amount: number }[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const name = key(row);
    totals.set(name, (totals.get(name) ?? 0) + toDecimalNumber(row.amount));
  }

  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function buildMonthBuckets(reference: Date, months: number) {
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = startOfUtcMonth(reference.getUTCFullYear(), reference.getUTCMonth() - i);
    buckets.push({
      key: monthKey(start),
      label: monthLabel(start),
      start,
      end: endOfUtcMonth(start.getUTCFullYear(), start.getUTCMonth()),
    });
  }

  return buckets;
}

// ---------------------------------------------------------------------------

export async function getDashboardData(startDate?: Date, endDate?: Date) {
  const now = new Date();
  const today = startOfUtcDay(now);

  const start = startDate ?? startOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth());
  const end = endDate ?? endOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth());

  const buckets = buildMonthBuckets(now, TREND_MONTHS);
  const trendStart = buckets[0].start;
  const trendEnd = buckets[buckets.length - 1].end;

  const [
    periodPayments,
    periodExpenses,
    periodOrders,
    firstOrderDates,
    openOrders,
    pipelineOrders,
    pendingRentals,
    upcomingEvents,
    overdueEventOrders,
    recentPayments,
    inventorySummary,
    ordersByStatus,
    trendPayments,
    trendExpenses,
    trendOrders,
  ] = await Promise.all([
    repo.getPaymentsByDateRange(start, end),
    repo.getExpensesByDateRange(start, end),
    repo.getOrdersWithPaymentsByDateRange(start, end),
    repo.getFirstOrderDateByClient(),
    repo.getOpenOrdersWithPayments(),
    repo.getPipelineOrders(),
    repo.getPendingRentals(),
    repo.getUpcomingEvents(today, UPCOMING_EVENT_LIMIT),
    repo.getOverdueEvents(today),
    repo.getRecentPayments(5),
    repo.getInventorySummary(),
    repo.getOrdersByStatus(),
    repo.getPaymentsForTrend(trendStart, trendEnd),
    repo.getExpensesForTrend(trendStart, trendEnd),
    repo.getSoldOrdersForTrend(trendStart, trendEnd),
  ]);

  // --- Resultados del periodo -------------------------------------------------

  const collected = sumAmounts(periodPayments);
  const expenses = sumAmounts(periodExpenses);
  const netCashFlow = collected - expenses;
  const marginPct = collected > 0 ? (netCashFlow / collected) * 100 : null;

  const sold = periodOrders.reduce((sum, o) => sum + toDecimalNumber(o.totalPrice), 0);
  const paidOnSold = periodOrders.reduce(
    (sum, o) => sum + o.payments.reduce((ps, p) => ps + toDecimalNumber(p.amount), 0),
    0
  );
  const ordersCount = periodOrders.length;

  const firstOrderByClient = new Map(
    firstOrderDates
      .filter((row) => row.clientId !== null && row._min.orderDate !== null)
      .map((row) => [row.clientId, row._min.orderDate as Date])
  );

  const clientsInPeriod = new Set(periodOrders.map((o) => o.clientId));
  let newClients = 0;
  for (const clientId of clientsInPeriod) {
    const firstOrder = firstOrderByClient.get(clientId);
    if (firstOrder && firstOrder >= start && firstOrder <= end) newClients += 1;
  }

  const paymentsByMethod = groupAmountsBy(periodPayments, (p) => p.paymentMethod);
  const expensesByCategory = groupAmountsBy(periodExpenses, (e) => e.category);

  // --- Cartera y alertas sobre pedidos abiertos -------------------------------

  const orderBalances = openOrders.map((order) => {
    const { total, paid, balance } = calculateOrderBalance(order);
    const minRequired = (total * toDecimalNumber(order.minDownpaymentPct)) / 100;
    const eventPassed = order.eventDate !== null && order.eventDate < today;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      clientId: order.client?.id ?? null,
      clientName: order.client?.name ?? "—",
      eventDate: order.eventDate,
      total,
      paid,
      balance,
      minRequired,
      isOverdue: balance > 0 && (order.status === "COMPLETED" || eventPassed),
    };
  });

  const withBalance = orderBalances.filter((o) => o.balance > 0);
  const receivablesTotal = withBalance.reduce((sum, o) => sum + o.balance, 0);
  const receivablesOverdue = withBalance
    .filter((o) => o.isOverdue)
    .reduce((sum, o) => sum + o.balance, 0);

  const deliveredWithBalance = orderBalances
    .filter((o) => o.status === "COMPLETED" && o.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const belowMinDownpayment = orderBalances
    .filter((o) => o.status === "CONFIRMED" && o.total > 0 && o.paid < o.minRequired)
    .sort((a, b) => b.balance - a.balance);

  const inconsistentOrders = orderBalances
    .filter((o) => (o.total <= 0 && o.paid > 0) || o.paid > o.total)
    .sort((a, b) => a.balance - b.balance);

  const debtByClient = new Map<string, { clientId: string | null; clientName: string; balance: number; orders: number }>();
  for (const order of withBalance) {
    const key = order.clientId ?? order.clientName;
    const current = debtByClient.get(key);
    if (current) {
      current.balance += order.balance;
      current.orders += 1;
    } else {
      debtByClient.set(key, {
        clientId: order.clientId,
        clientName: order.clientName,
        balance: order.balance,
        orders: 1,
      });
    }
  }
  const topDebtors = [...debtByClient.values()].sort((a, b) => b.balance - a.balance).slice(0, 5);

  // --- Alquileres pendientes de devolución ------------------------------------

  const returns = pendingRentals.map((rental) => {
    const item = rental.orderItem;
    const productName = item?.product?.name ?? item?.name ?? "—";

    return {
      id: rental.id,
      orderId: item?.order?.id ?? null,
      orderNumber: item?.order?.orderNumber ?? null,
      clientName: item?.order?.client?.name ?? "—",
      productCode: item?.product?.code ?? null,
      productName,
      returnDate: rental.returnDate,
      deposit: toDecimalNumber(rental.deposit),
      daysOverdue: rental.returnDate ? daysBetweenUtc(rental.returnDate, today) : null,
    };
  });

  const overdueRentals = returns.filter((r) => r.daysOverdue !== null && r.daysOverdue > 0);

  // --- Eventos vencidos sin cerrar --------------------------------------------

  const overdueEvents = overdueEventOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    clientName: order.client?.name ?? "—",
    eventDate: order.eventDate,
    daysOverdue: order.eventDate ? daysBetweenUtc(order.eventDate, today) : 0,
  }));

  // --- Estado a hoy -----------------------------------------------------------

  const pipelineValue = pipelineOrders.reduce((sum, o) => sum + toDecimalNumber(o.totalPrice), 0);

  const inventory = inventorySummary.map((group) => ({
    status: group.status,
    count: group._count.status,
    units: group._sum.quantityOnHand ?? 0,
  }));
  const inventoryAvailable = inventory.find((i) => i.status === "AVAILABLE")?.units ?? 0;

  // --- Tendencias -------------------------------------------------------------

  const paymentsIndex = new Map(buckets.map((b) => [b.key, 0]));
  for (const payment of trendPayments) {
    const key = monthKey(payment.paymentDate);
    if (paymentsIndex.has(key)) {
      paymentsIndex.set(key, paymentsIndex.get(key)! + toDecimalNumber(payment.amount));
    }
  }

  const expensesIndex = new Map(buckets.map((b) => [b.key, 0]));
  for (const expense of trendExpenses) {
    const key = monthKey(expense.date);
    if (expensesIndex.has(key)) {
      expensesIndex.set(key, expensesIndex.get(key)! + toDecimalNumber(expense.amount));
    }
  }

  const salesIndex = new Map(buckets.map((b) => [b.key, 0]));
  for (const order of trendOrders) {
    const key = monthKey(order.orderDate);
    if (salesIndex.has(key)) {
      salesIndex.set(key, salesIndex.get(key)! + toDecimalNumber(order.totalPrice));
    }
  }

  const monthlyData = buckets.map((b) => ({
    month: b.label,
    revenue: paymentsIndex.get(b.key) ?? 0,
    expenses: expensesIndex.get(b.key) ?? 0,
  }));

  const salesMonthlyData = buckets.map((b) => ({
    month: b.label,
    sales: salesIndex.get(b.key) ?? 0,
  }));

  return {
    range: { start, end },
    period: {
      collected,
      expenses,
      netCashFlow,
      marginPct,
      sold,
      paidOnSold,
      pendingOnSold: sold - paidOnSold,
      ordersCount,
      averageTicket: ordersCount > 0 ? sold / ordersCount : 0,
      newClients,
      returningClients: clientsInPeriod.size - newClients,
      paymentsByMethod,
      expensesByCategory,
    },
    today: {
      receivablesTotal,
      receivablesOverdue,
      receivablesUpcoming: receivablesTotal - receivablesOverdue,
      pipelineCount: pipelineOrders.length,
      pipelineValue,
      activeRentals: returns.length,
      overdueRentalsCount: overdueRentals.length,
      inventoryAvailable,
    },
    alerts: {
      overdueRentals,
      deliveredWithBalance,
      belowMinDownpayment,
      overdueEvents,
      inconsistentOrders,
    },
    topDebtors,
    pendingReturns: returns,
    upcomingEvents,
    recentPayments,
    inventorySummary: inventory,
    ordersByStatus: ordersByStatus.map((g) => ({
      status: g.status,
      count: g._count.status,
    })),
    monthlyData,
    salesMonthlyData,
  };
}

export async function getTopProducts(limit = 5) {
  const items = await repo.getSoldOrderItems();

  const totals = new Map<
    string,
    { code: string; name: string; revenue: number; quantity: number; orderIds: Set<string> }
  >();

  for (const item of items) {
    if (!item.productId) continue;

    const current = totals.get(item.productId) ?? {
      code: item.product?.code ?? "",
      name: item.product?.name ?? "",
      revenue: 0,
      quantity: 0,
      orderIds: new Set<string>(),
    };

    current.revenue += calculateItemSubtotal(item);
    current.quantity += item.quantity;
    current.orderIds.add(item.orderId);
    totals.set(item.productId, current);
  }

  return [...totals.entries()]
    .map(([productId, entry]) => ({
      productId,
      code: entry.code,
      name: entry.name,
      revenue: entry.revenue,
      quantity: entry.quantity,
      orderCount: entry.orderIds.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
