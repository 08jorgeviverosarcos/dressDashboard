import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Consultas del periodo seleccionado (respetan el filtro de fechas del panel)
// ---------------------------------------------------------------------------

export function getPaymentsByDateRange(start: Date, end: Date) {
  return prisma.payment.findMany({
    where: { paymentDate: { gte: start, lte: end } },
    select: { amount: true, paymentMethod: true },
  });
}

export function getExpensesByDateRange(start: Date, end: Date) {
  return prisma.expense.findMany({
    where: { date: { gte: start, lte: end } },
    select: { amount: true, category: true, expenseType: true },
  });
}

export function getOrdersWithPaymentsByDateRange(start: Date, end: Date) {
  return prisma.order.findMany({
    where: {
      status: { in: ["CONFIRMED", "COMPLETED"] },
      orderDate: { gte: start, lte: end },
    },
    select: {
      clientId: true,
      totalPrice: true,
      payments: {
        where: { deletedAt: null },
        select: { amount: true },
      },
    },
  });
}

/**
 * Histórico completo, sin rango de fechas: cada vestido se vende o alquila una
 * vez por pedido, así que un ranking acotado a un mes deja a todos empatados en
 * un pedido y no dice nada. Acumulado sí muestra qué modelos rotan más.
 */
export function getSoldOrderItems() {
  return prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      order: {
        deletedAt: null,
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    },
    select: {
      orderId: true,
      productId: true,
      quantity: true,
      unitPrice: true,
      discountType: true,
      discountValue: true,
      product: { select: { code: true, name: true } },
    },
  });
}

/**
 * Fecha del primer pedido de cada cliente. `Client.createdAt` no sirve para
 * medir clientes nuevos porque la base se cargó por importación y todos los
 * registros comparten la misma fecha de creación.
 */
export function getFirstOrderDateByClient() {
  return prisma.order.groupBy({
    by: ["clientId"],
    where: { status: { notIn: ["CANCELLED"] } },
    _min: { orderDate: true },
  });
}

// ---------------------------------------------------------------------------
// Consultas de estado a hoy (no dependen del filtro de fechas)
// ---------------------------------------------------------------------------

export function getOpenOrdersWithPayments() {
  return prisma.order.findMany({
    where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderDate: true,
      eventDate: true,
      totalPrice: true,
      minDownpaymentPct: true,
      client: { select: { id: true, name: true } },
      payments: {
        where: { deletedAt: null },
        select: { amount: true },
      },
    },
    orderBy: { orderDate: "asc" },
  });
}

export function getPipelineOrders() {
  return prisma.order.findMany({
    where: { status: { in: ["QUOTE", "CONFIRMED"] } },
    select: { totalPrice: true },
  });
}

export function getPendingRentals() {
  return prisma.rental.findMany({
    where: {
      actualReturnDate: null,
      orderItem: {
        deletedAt: null,
        order: { deletedAt: null, status: { notIn: ["CANCELLED"] } },
      },
    },
    select: {
      id: true,
      returnDate: true,
      deposit: true,
      orderItem: {
        select: {
          id: true,
          name: true,
          product: { select: { code: true, name: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              client: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { returnDate: "asc" },
  });
}

export function getUpcomingEvents(from: Date, limit: number) {
  return prisma.order.findMany({
    where: {
      eventDate: { gte: from },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    include: { client: true },
    orderBy: { eventDate: "asc" },
    take: limit,
  });
}

export function getOverdueEvents(before: Date) {
  return prisma.order.findMany({
    where: {
      eventDate: { lt: before },
      status: { in: ["QUOTE", "CONFIRMED"] },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      eventDate: true,
      client: { select: { name: true } },
    },
    orderBy: { eventDate: "asc" },
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
    _sum: { quantityOnHand: true },
  });
}

export function getOrdersByStatus() {
  return prisma.order.groupBy({
    by: ["status"],
    _count: { status: true },
  });
}

// ---------------------------------------------------------------------------
// Series de tendencia (ventana fija de meses, una sola consulta por serie)
// ---------------------------------------------------------------------------

export function getPaymentsForTrend(start: Date, end: Date) {
  return prisma.payment.findMany({
    where: { paymentDate: { gte: start, lte: end } },
    select: { paymentDate: true, amount: true },
  });
}

export function getExpensesForTrend(start: Date, end: Date) {
  return prisma.expense.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true, amount: true },
  });
}

export function getSoldOrdersForTrend(start: Date, end: Date) {
  return prisma.order.findMany({
    where: {
      status: { in: ["CONFIRMED", "COMPLETED"] },
      orderDate: { gte: start, lte: end },
    },
    select: { orderDate: true, totalPrice: true },
  });
}
