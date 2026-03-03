---
date: 2026-03-03T10:11:07-0500
researcher: GPT-5.3 Codex (Cursor)
git_commit: 9657a1b
branch: main
repository: dressDashboard
topic: "Mostrar costos en factura y dashboard financiero con filtros por mes/rango y visibilidad solo admin"
tags: [research, codebase, dashboard, payments, expenses, orders, roles, factura, costos]
status: complete
last_updated: 2026-03-03
last_updated_by: GPT-5.3 Codex (Cursor)
last_updated_note: "Added follow-up research for trazabilidad exacta de métricas financieras (UI -> Prisma)"
---

# Research: Mostrar costos en factura y dashboard financiero con filtros por mes/rango y visibilidad solo admin

**Date**: 2026-03-03T10:11:07-0500  
**Researcher**: GPT-5.3 Codex (Cursor)  
**Git Commit**: 9657a1b  
**Branch**: main  
**Repository**: dressDashboard

## Research Question
mostrar costos en factura; mostrar en dashboard ingresos mes, gastos mes, ingresos vs gastos, flujo neto, ganancias; poder filtrar por meses o por fecha inicio/fin; y que esto solo se muestre para rol admin.

## Summary
El sistema actual ya tiene métricas financieras en dashboard para ingresos del mes, gastos del mes, flujo neto y ganancia mensual, además de una gráfica de ingresos vs gastos para los últimos 6 meses.  
No existe un módulo explícito de factura/comprobante fiscal (PDF/impresión); el equivalente operativo actual es el detalle de pago y el detalle de pedido, donde sí se muestran totales, costo y ganancia.  
Los filtros por fecha inicio/fin están implementados hoy en pagos (y soportados en repositorios de pagos/gastos), mientras que en dashboard el periodo KPI por defecto es mes actual y la comparativa mensual es fija a últimos 6 meses.  
El control por rol admin existe en el sistema (sesión con `ADMIN|SALES`, navegación condicional y guard explícito en `/usuarios`), pero no hay guard específico de admin aplicado hoy sobre la página principal del dashboard financiero.

## Detailed Findings

### Dashboard financiero actual (ingresos, gastos, flujo neto, ganancia)
- La página principal del dashboard renderiza tarjetas con `Ingresos (mes)`, `Gastos (mes)`, `Flujo Neto` y `Ganancia (mes)` en `src/app/(dashboard)/page.tsx`.
- La acción server delega la carga del dashboard a servicio en `src/lib/actions/dashboard.ts`.
- La lógica de negocio está en `src/features/dashboard/dashboard.service.ts`:
  - periodo por defecto: primer y último día del mes actual;
  - `totalRevenue`: suma de pagos del rango;
  - `totalExpenses`: suma de gastos del rango;
  - `netCashFlow`: ingresos - gastos;
  - `totalProfit`: suma de (`totalPrice - totalCost`) de pedidos completados del rango.
- La comparativa `Ingresos vs Gastos` se arma por mes en `_getMonthlyTrends()` (últimos 6 meses).
- La visualización está en `src/app/(dashboard)/dashboard-charts.tsx` (Recharts), con un `BarChart` para ingresos vs gastos y otro para pipeline por estado.

### Datos y queries que alimentan métricas
- Las consultas están encapsuladas en `src/features/dashboard/dashboard.repo.ts`:
  - `getPaymentsByDateRange(start, end)` sobre `paymentDate`;
  - `getExpensesByDateRange(start, end)` sobre `date`;
  - `getCompletedOrdersByDateRange(start, end)` con `status: COMPLETED` + `updatedAt`;
  - `getOrdersByStatus()` por `groupBy`;
  - `getOrderItemRevenue(limit)` para top productos.
- Campos de modelo financieros relevantes en `prisma/schema.prisma`:
  - `Order.totalPrice`, `Order.totalCost`;
  - `OrderItem.costSource`, `OrderItem.costAmount`;
  - `Payment.paymentDate`, `Payment.amount`;
  - `Expense.date`, `Expense.amount`.

### Factura/comprobante y costos en la implementación actual
- No se encontró un módulo dedicado de factura/invoice/receipt en rutas de `src/app`.
- El detalle de pago (`src/app/(dashboard)/pagos/[id]/page.tsx`) funciona como vista de comprobante de pago operativo (monto, fecha, método, referencia, pedido vinculado).
- El detalle de pedido (`src/app/(dashboard)/pedidos/[id]/page.tsx`) muestra resumen financiero con total, pagado, restante y bloque `Ganancia`/`Costo` según estado del pedido.
- En esquema actual sí existe costo persistido en pedido/items (`totalCost`, `costAmount`), y la ganancia se calcula al vuelo en UI/servicio.

### Filtros por fecha/mes en estado actual
- Filtro por rango (`startDate`, `endDate`) está implementado en el módulo de pagos:
  - UI de filtros fecha en `src/app/(dashboard)/pagos/payments-table.tsx`;
  - parse de `searchParams` y envío de rango en `src/app/(dashboard)/pagos/page.tsx`;
  - soporte en action/servicio/repo de pagos.
- El repositorio de gastos también soporta rango de fechas, aunque la página de gastos actual usa otros filtros de query (búsqueda/categoría/tipo) según el estado encontrado.
- En dashboard:
  - KPIs usan mes actual por defecto (o rango si se invoca con parámetros);
  - comparación mensual está implementada para últimos 6 meses.

### Restricción por rol admin
- El sistema de sesión define `UserRole` con `ADMIN` y `SALES` en `prisma/schema.prisma`.
- El layout del dashboard exige sesión y pasa `userRole` al `Sidebar` (`src/app/(dashboard)/layout.tsx`).
- El sidebar agrega navegación admin condicional (`userRole === "ADMIN"`) en `src/components/layout/Sidebar.tsx`.
- Existe guard explícito admin en `src/app/(dashboard)/usuarios/page.tsx` (`if (session.role !== "ADMIN") redirect("/")`).
- No se encontró guard admin específico en la página principal `src/app/(dashboard)/page.tsx`.

## Code References
- `src/app/(dashboard)/page.tsx:35` - tarjeta `Ingresos (mes)`.
- `src/app/(dashboard)/page.tsx:44` - tarjeta `Gastos (mes)`.
- `src/app/(dashboard)/page.tsx:53` - tarjeta `Flujo Neto`.
- `src/app/(dashboard)/page.tsx:73` - tarjeta `Ganancia (mes)`.
- `src/features/dashboard/dashboard.service.ts:4` - `_getMonthlyTrends()` para últimos 6 meses.
- `src/features/dashboard/dashboard.service.ts:32` - `getDashboardData(startDate?, endDate?)`.
- `src/features/dashboard/dashboard.service.ts:76` - cálculo de `netCashFlow`.
- `src/features/dashboard/dashboard.service.ts:67` - cálculo de `totalProfit`.
- `src/features/dashboard/dashboard.repo.ts:3` - pagos por rango de fecha.
- `src/features/dashboard/dashboard.repo.ts:10` - gastos por rango de fecha.
- `src/features/dashboard/dashboard.repo.ts:17` - pedidos completados por rango.
- `src/app/(dashboard)/dashboard-charts.tsx:37` - título ingresos vs gastos (6 meses).
- `src/app/(dashboard)/pagos/payments-table.tsx:156` - input `startDate`.
- `src/app/(dashboard)/pagos/payments-table.tsx:165` - input `endDate`.
- `src/app/(dashboard)/pagos/page.tsx:14` - parse `startDate`.
- `src/app/(dashboard)/pagos/page.tsx:15` - parse `endDate`.
- `src/app/(dashboard)/pedidos/[id]/page.tsx:31` - cálculo de `profit`.
- `src/app/(dashboard)/pedidos/[id]/page.tsx:85` - etiqueta `Ganancia`/`Costo`.
- `src/app/(dashboard)/pagos/[id]/page.tsx:23` - encabezado detalle de pago.
- `src/app/(dashboard)/layout.tsx:9` - `verifySession()` en layout dashboard.
- `src/components/layout/Sidebar.tsx:49` - nav admin condicional por rol.
- `src/app/(dashboard)/usuarios/page.tsx:9` - guard de admin.
- `prisma/schema.prisma:208` - enum `UserRole`.
- `prisma/schema.prisma:88` - `Order.totalPrice`.
- `prisma/schema.prisma:89` - `Order.totalCost`.
- `prisma/schema.prisma:120` - `OrderItem.costSource`.
- `prisma/schema.prisma:121` - `OrderItem.costAmount`.

## Architecture Insights
- Patrón observado: `App Router page` -> `server action` -> `feature service` -> `feature repo (Prisma)`.
- Las métricas financieras se calculan en `service` sobre colecciones devueltas por `repo`, no en UI.
- El control de rol combina:
  - validación de sesión central (`verifySession`) para acceso al dashboard;
  - autorización puntual por página/acción para recursos administrativos.

## Historical Context (from thoughts/)
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md` - documentación de cálculos financieros y gastos por fecha.
- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md` - contexto de rentabilidad/ganancia en rentas.
- `thoughts/shared/research/2026-02-19_14-56-25_[general]_paymentmethod-catalogo.md` - filtros en pagos y catálogo de métodos.
- `thoughts/shared/research/2026-02-27_16-28-41_[general]_autenticacion-roles-estado-actual-y-opciones.md` - estado de autenticación y roles.
- `thoughts/shared/plans/2026-02-27_21-48-37_[general]_autenticacion-roles-implementacion.md` - plan histórico de implementación de permisos admin.
- `thoughts/shared/research/2026-03-02_17-40-39_[general]_rentalcost-current-state.md` - estado relacionado a costos de renta.

## Related Research
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md`
- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
- `thoughts/shared/research/2026-02-27_16-28-41_[general]_autenticacion-roles-estado-actual-y-opciones.md`
- `thoughts/shared/research/2026-03-02_17-40-39_[general]_rentalcost-current-state.md`

## Open Questions
- Si por “factura” se requiere documento formal (imprimible/PDF), no se observó un módulo dedicado en rutas del app en este commit.
- No se encontró guard de admin específico en la ruta principal del dashboard (`/`); el control admin hoy se observó en navegación y rutas puntuales como `/usuarios`.

## Follow-up Research 2026-03-03 10:17:58 -0500

### Trazabilidad exacta: métrica -> UI -> action -> service -> repo -> Prisma

#### 1) Ingresos (mes)
- **UI (render)**: `src/app/(dashboard)/page.tsx` usa `formatCurrency(data.kpis.totalRevenue)`.
- **Action**: `src/lib/actions/dashboard.ts` expone `getDashboardData(startDate?, endDate?)`.
- **Service (cálculo)**: `src/features/dashboard/dashboard.service.ts` suma `paymentsThisMonth.reduce(... amount ...)` en `totalRevenue`.
- **Repo (query)**: `src/features/dashboard/dashboard.repo.ts` `getPaymentsByDateRange(start, end)` con `select: { amount: true }`.
- **Campos Prisma**: `Payment.paymentDate` (filtro rango) y `Payment.amount` (sumatoria) en `prisma/schema.prisma`.

#### 2) Gastos (mes)
- **UI (render)**: `src/app/(dashboard)/page.tsx` usa `formatCurrency(data.kpis.totalExpenses)`.
- **Action**: `src/lib/actions/dashboard.ts` `getDashboardData(...)`.
- **Service (cálculo)**: `src/features/dashboard/dashboard.service.ts` suma `expensesThisMonth.reduce(... amount ...)` en `totalExpenses`.
- **Repo (query)**: `src/features/dashboard/dashboard.repo.ts` `getExpensesByDateRange(start, end)` con `select: { amount: true }`.
- **Campos Prisma**: `Expense.date` (filtro rango) y `Expense.amount` (sumatoria) en `prisma/schema.prisma`.

#### 3) Flujo Neto
- **UI (render)**: `src/app/(dashboard)/page.tsx` usa `formatCurrency(data.kpis.netCashFlow)`.
- **Action**: `src/lib/actions/dashboard.ts` `getDashboardData(...)`.
- **Service (fórmula)**: `src/features/dashboard/dashboard.service.ts` define `netCashFlow: totalRevenue - totalExpenses`.
- **Repo/Prisma**: reutiliza exactamente las mismas fuentes de ingresos y gastos descritas arriba.

#### 4) Ganancia (mes)
- **UI (render)**: `src/app/(dashboard)/page.tsx` usa `formatCurrency(data.kpis.totalProfit)`.
- **Action**: `src/lib/actions/dashboard.ts` `getDashboardData(...)`.
- **Service (cálculo)**: `src/features/dashboard/dashboard.service.ts` calcula `totalProfit` como suma de `(totalPrice - totalCost)` sobre `completedOrders`.
- **Repo (query)**: `src/features/dashboard/dashboard.repo.ts` `getCompletedOrdersByDateRange(start, end)` con `where: { status: "COMPLETED", updatedAt: { gte, lte } }` y `select: { totalPrice, totalCost }`.
- **Campos Prisma**: `Order.status`, `Order.updatedAt`, `Order.totalPrice`, `Order.totalCost` en `prisma/schema.prisma`.

#### 5) Ingresos vs Gastos (gráfica mensual)
- **UI (render chart)**: `src/app/(dashboard)/dashboard-charts.tsx` muestra `Ingresos vs Gastos (últimos 6 meses)` con `monthlyData`.
- **Service (serie temporal)**: `src/features/dashboard/dashboard.service.ts` `_getMonthlyTrends()` itera últimos 6 meses y arma `{ month, revenue, expenses }`.
- **Repo (queries por mes)**: dentro de cada mes llama `getPaymentsByDateRange` y `getExpensesByDateRange`.
- **Prisma**: mismas fuentes `Payment.paymentDate/amount` y `Expense.date/amount`.

### Trazabilidad exacta de filtros de fecha existentes

#### 6) Filtros `startDate/endDate` en pagos
- **UI filtros**: `src/app/(dashboard)/pagos/payments-table.tsx` tiene dos inputs `type="date"` y `handleDateChange("startDate" | "endDate", value)`.
- **Page parse**: `src/app/(dashboard)/pagos/page.tsx` toma `searchParams` y convierte a `Date` (`new Date(params.startDate/endDate)`).
- **Action/Service/Repo**: `getPayments(...)` delega y termina aplicando rango en repo de pagos.
- **Prisma fuente**: `Payment.paymentDate`.

### Nota de precisión sobre periodo en dashboard
- En el estado actual, `src/app/(dashboard)/page.tsx` llama `getDashboardData()` **sin parámetros**, por lo que los KPI de la cabecera salen del rango por defecto del servicio (mes actual).
