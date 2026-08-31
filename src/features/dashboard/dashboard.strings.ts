export const DASHBOARD_STRINGS = {
  title: "Panel",
  subtitle: "Resumen general del negocio",

  sections: {
    alerts: "Requiere tu atención",
    period: "Resultados del periodo",
    today: "Estado a hoy",
    trends: "Tendencias",
    detail: "Detalle",
  },

  periodPrefix: "Periodo",
  todayHint: "No depende del filtro de fechas",

  kpis: {
    collected: "Cobrado",
    collectedHint: "Pagos recibidos en el periodo",
    expenses: "Gastos",
    expensesHint: "Gastos registrados en el periodo",
    netCashFlow: "Flujo de caja",
    netCashFlowHint: "Cobrado menos gastos",
    margin: "Margen de caja",
    sold: "Vendido",
    soldHint: "Valor de los pedidos creados en el periodo",
    ordersCount: "Pedidos del periodo",
    ordersCountHint: "Clientes que compraron en el periodo",
    averageTicket: "Ticket promedio",
    receivables: "Cartera por cobrar",
    receivablesHint: "Saldo pendiente de todos los pedidos abiertos",
    receivablesOverdue: "vencida",
    receivablesUpcoming: "por vencer",
    pipeline: "Pedidos en pipeline",
    pipelineHint: "Cotizaciones y confirmados sin entregar",
    activeRentals: "Alquileres en curso",
    activeRentalsHint: "Prendas entregadas sin devolver",
    inventoryAvailable: "Inventario disponible",
    inventoryAvailableHint: "Unidades listas para alquilar o vender",
  },

  alerts: {
    overdueRentals: {
      title: "Alquileres vencidos sin devolver",
      description: "La fecha de retorno ya pasó y la prenda no ha vuelto.",
    },
    deliveredWithBalance: {
      title: "Pedidos entregados con saldo pendiente",
      description: "Se entregó la prenda pero el cliente aún debe.",
    },
    belowMinDownpayment: {
      title: "Pedidos confirmados sin el abono mínimo",
      description: "Confirmados por debajo del porcentaje mínimo pactado.",
    },
    overdueEvents: {
      title: "Eventos ya pasados sin cerrar",
      description: "El evento ocurrió y el pedido sigue sin entregarse ni cancelarse.",
    },
    inconsistentOrders: {
      title: "Pedidos con totales inconsistentes",
      description: "El pedido tiene pagos que no cuadran con su total.",
    },
    allClear: "Sin alertas pendientes. Todo al día.",
  },

  charts: {
    revenueVsExpenses: "Cobros vs Gastos",
    revenueVsExpensesHint: "Últimos 6 meses",
    sales: "Ventas por mes",
    salesHint: "Valor de pedidos confirmados y entregados",
    pipeline: "Pipeline de pedidos",
    pipelineHint: "Pedidos por estado",
    expensesByCategory: "Gastos por categoría",
    paymentsByMethod: "Cobros por método de pago",
    soldVsPaid: "Vendido vs Abonado",
    soldVsPaidHint: "Sobre los pedidos del periodo",
    revenue: "Cobros",
    expenses: "Gastos",
    salesSeries: "Ventas",
    orders: "Pedidos",
    amount: "Monto",
    paid: "Abonado",
    pending: "Pendiente",
    totalSold: "Total vendido",
  },

  tables: {
    upcomingEvents: "Próximos eventos",
    upcomingEventsHint: "Los 10 eventos más cercanos",
    pendingReturns: "Devoluciones pendientes",
    topDebtors: "Clientes con mayor saldo",
    topProducts: "Top productos por ingreso",
    topProductsHint: "Histórico completo, no depende del filtro",
    recentPayments: "Pagos recientes",
    inventory: "Resumen de inventario",
  },

  labels: {
    noDate: "Sin fecha",
    overdue: "Vencido",
    daysLate: (days: number) => (days === 1 ? "1 día de atraso" : `${days} días de atraso`),
    dueToday: "Vence hoy",
    daysLeft: (days: number) => (days === 1 ? "Vence mañana" : `Faltan ${days} días`),
    orderCount: (count: number) => (count === 1 ? "1 pedido" : `${count} pedidos`),
    clientMix: (newClients: number, returning: number) =>
      `${newClients} ${newClients === 1 ? "nuevo" : "nuevos"} · ${returning} ${
        returning === 1 ? "recurrente" : "recurrentes"
      }`,
    units: "unidades",
    seeAll: "Ver todos",
    balance: "Saldo",
  },

  empty: {
    events: "Sin eventos próximos",
    returns: "Sin devoluciones pendientes",
    debtors: "Sin saldos pendientes",
    products: "Sin ventas en el periodo",
    payments: "Sin pagos en el periodo",
    inventory: "Sin datos de inventario",
    expenses: "Sin gastos en el periodo",
    generic: "Sin datos",
  },

  filters: {
    month: "Mes",
    from: "Desde",
    to: "Hasta",
    clear: "Limpiar",
    quickRanges: "Rangos rápidos",
    thisMonth: "Este mes",
    lastMonth: "Mes pasado",
    last3Months: "Últimos 3 meses",
    thisYear: "Este año",
  },
} as const;
