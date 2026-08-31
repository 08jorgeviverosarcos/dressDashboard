import Link from "next/link";
import {
  BadgeDollarSign,
  Banknote,
  Package,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";

import { getDashboardData, getTopProducts } from "@/lib/actions/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AttentionPanel } from "@/features/dashboard/components/AttentionPanel";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { DASHBOARD_STRINGS as S } from "@/features/dashboard/dashboard.strings";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import { verifySession } from "@/lib/dal";
import { DashboardCharts } from "./dashboard-charts";
import { DashboardFilters } from "./dashboard-filters";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface Props {
  searchParams: Promise<{
    month?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

/**
 * Las fechas se guardan como medianoche de Colombia y se muestran en UTC, así
 * que los cortes del filtro también se construyen en UTC: el día "hasta" debe
 * llegar hasta el final del día o se pierde el último día del rango.
 */
function parseRangeStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseRangeEnd(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getDateRangeFromMonth(month?: string): { start?: Date; end?: Date } {
  if (!month) return {};
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return {};
  }

  return {
    start: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)),
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysUntil(target: Date, today: Date): number {
  return Math.round((startOfUtcDay(target).getTime() - today.getTime()) / MS_PER_DAY);
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ListCard({
  title,
  hint,
  action,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            {hint && <CardDescription>{hint}</CardDescription>}
          </div>
          {action && (
            <Link href={action.href} className="text-sm text-primary hover:underline">
              {action.label}
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : children}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await verifySession();
  const isAdmin = session.role === "ADMIN";

  const params = await searchParams;
  const monthRange = getDateRangeFromMonth(params.month);
  const rangeStart = parseRangeStart(params.startDate) ?? monthRange.start;
  const rangeEnd = parseRangeEnd(params.endDate) ?? monthRange.end;

  const [data, topProducts] = await Promise.all([
    getDashboardData(rangeStart, rangeEnd),
    getTopProducts(),
  ]);

  const today = startOfUtcDay(new Date());
  const { period, today: state, alerts } = data;
  const rangeLabel = `${formatDate(data.range.start)} – ${formatDate(data.range.end)}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{S.title}</h1>
        <p className="text-muted-foreground">{S.subtitle}</p>
      </div>

      {isAdmin && <DashboardFilters />}

      <AttentionPanel
        overdueRentals={alerts.overdueRentals}
        deliveredWithBalance={alerts.deliveredWithBalance}
        belowMinDownpayment={alerts.belowMinDownpayment}
        overdueEvents={alerts.overdueEvents}
        inconsistentOrders={alerts.inconsistentOrders}
      />

      {isAdmin && (
        <section className="space-y-4">
          <SectionHeading title={S.sections.period} hint={`${S.periodPrefix}: ${rangeLabel}`} />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <StatCard
              label={S.kpis.collected}
              hint={S.kpis.collectedHint}
              value={formatCurrency(period.collected)}
              icon={Banknote}
              href="/pagos"
            />
            <StatCard
              label={S.kpis.expenses}
              hint={S.kpis.expensesHint}
              value={formatCurrency(period.expenses)}
              icon={TrendingDown}
              tone="negative"
              href="/gastos"
            />
            <StatCard
              label={S.kpis.netCashFlow}
              hint={S.kpis.netCashFlowHint}
              value={formatCurrency(period.netCashFlow)}
              icon={TrendingUp}
              tone={period.netCashFlow >= 0 ? "positive" : "negative"}
              footer={`${S.kpis.margin}: ${formatPercent(period.marginPct, 1)}`}
            />
            <StatCard
              label={S.kpis.sold}
              hint={S.kpis.soldHint}
              value={formatCurrency(period.sold)}
              icon={Receipt}
              href="/pedidos"
            />
            <StatCard
              label={S.kpis.ordersCount}
              hint={S.kpis.ordersCountHint}
              value={String(period.ordersCount)}
              icon={ShoppingBag}
              footer={S.labels.clientMix(period.newClients, period.returningClients)}
              href="/pedidos"
            />
            <StatCard
              label={S.kpis.averageTicket}
              value={formatCurrency(period.averageTicket)}
              icon={BadgeDollarSign}
            />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <SectionHeading title={S.sections.today} hint={S.todayHint} />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {isAdmin && (
            <StatCard
              label={S.kpis.receivables}
              hint={S.kpis.receivablesHint}
              value={formatCurrency(state.receivablesTotal)}
              icon={Wallet}
              tone={state.receivablesOverdue > 0 ? "warning" : "neutral"}
              footer={
                <span className="flex flex-wrap gap-x-3">
                  <span className="text-red-600 dark:text-red-400">
                    {formatCurrency(state.receivablesOverdue)} {S.kpis.receivablesOverdue}
                  </span>
                  <span>
                    {formatCurrency(state.receivablesUpcoming)} {S.kpis.receivablesUpcoming}
                  </span>
                </span>
              }
            />
          )}
          <StatCard
            label={S.kpis.pipeline}
            hint={S.kpis.pipelineHint}
            value={String(state.pipelineCount)}
            icon={ShoppingBag}
            footer={isAdmin ? formatCurrency(state.pipelineValue) : undefined}
            href="/pedidos"
          />
          <StatCard
            label={S.kpis.activeRentals}
            hint={S.kpis.activeRentalsHint}
            value={String(state.activeRentals)}
            icon={Undo2}
            tone={state.overdueRentalsCount > 0 ? "negative" : "neutral"}
            footer={
              state.overdueRentalsCount > 0
                ? `${state.overdueRentalsCount} vencidos`
                : undefined
            }
          />
          <StatCard
            label={S.kpis.inventoryAvailable}
            hint={S.kpis.inventoryAvailableHint}
            value={`${state.inventoryAvailable}`}
            icon={Package}
            href="/inventario"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title={S.sections.trends} />
        <DashboardCharts
          monthlyData={data.monthlyData}
          salesMonthlyData={data.salesMonthlyData}
          ordersByStatus={data.ordersByStatus}
          expensesByCategory={period.expensesByCategory}
          paymentsByMethod={period.paymentsByMethod}
          salesSummary={{
            totalSold: period.sold,
            totalPaid: period.paidOnSold,
            totalPending: period.pendingOnSold,
          }}
          showFinancial={isAdmin}
        />
      </section>

      <section className="space-y-4">
        <SectionHeading title={S.sections.detail} />

        <div className="grid gap-6 md:grid-cols-2">
          <ListCard
            title={S.tables.upcomingEvents}
            hint={S.tables.upcomingEventsHint}
            action={{ href: "/pedidos", label: S.labels.seeAll }}
            isEmpty={data.upcomingEvents.length === 0}
            emptyLabel={S.empty.events}
          >
            <div className="space-y-2">
              {data.upcomingEvents.map((event) => {
                const days = event.eventDate ? daysUntil(event.eventDate, today) : null;

                return (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/pedidos/${event.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        #{event.orderNumber}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        {event.client.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <span className="whitespace-nowrap text-muted-foreground">
                          {event.eventDate ? formatDate(event.eventDate) : S.labels.noDate}
                        </span>
                        <StatusBadge status={event.status} />
                      </div>
                      {days !== null && (
                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                          {days <= 0 ? S.labels.dueToday : S.labels.daysLeft(days)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ListCard>

          <ListCard
            title={S.tables.pendingReturns}
            isEmpty={data.pendingReturns.length === 0}
            emptyLabel={S.empty.returns}
          >
            <div className="space-y-2">
              {data.pendingReturns.slice(0, 8).map((rental) => {
                const isOverdue = rental.daysOverdue !== null && rental.daysOverdue > 0;

                return (
                  <div
                    key={rental.id}
                    className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                      isOverdue ? "border-red-500/40 bg-red-500/5" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {rental.orderId ? (
                        <Link
                          href={`/pedidos/${rental.orderId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          #{rental.orderNumber}
                        </Link>
                      ) : (
                        <span className="font-medium">—</span>
                      )}
                      <span className="ml-2 text-sm text-muted-foreground">{rental.clientName}</span>
                      <p className="truncate text-xs text-muted-foreground">
                        {rental.productCode ? `${rental.productCode} · ` : ""}
                        {rental.productName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <div className="whitespace-nowrap">
                        {rental.returnDate ? formatDate(rental.returnDate) : S.labels.noDate}
                      </div>
                      <div
                        className={`whitespace-nowrap text-xs ${
                          isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                        }`}
                      >
                        {isOverdue
                          ? S.labels.daysLate(rental.daysOverdue ?? 0)
                          : rental.returnDate === null
                            ? S.labels.noDate
                            : rental.daysOverdue === 0
                              ? S.labels.dueToday
                              : S.labels.daysLeft(Math.abs(rental.daysOverdue ?? 0))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ListCard>

          {isAdmin && (
            <ListCard
              title={S.tables.topDebtors}
              isEmpty={data.topDebtors.length === 0}
              emptyLabel={S.empty.debtors}
            >
              <div className="space-y-3">
                {data.topDebtors.map((debtor) => (
                  <div
                    key={debtor.clientId ?? debtor.clientName}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      {debtor.clientId ? (
                        <Link
                          href={`/clientes/${debtor.clientId}`}
                          className="block truncate text-primary hover:underline"
                        >
                          {debtor.clientName}
                        </Link>
                      ) : (
                        <span className="block truncate">{debtor.clientName}</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {S.labels.orderCount(debtor.orders)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(debtor.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </ListCard>
          )}

          {isAdmin && (
            <ListCard
              title={S.tables.topProducts}
              hint={S.tables.topProductsHint}
              isEmpty={topProducts.length === 0}
              emptyLabel={S.empty.products}
            >
              <div className="space-y-3">
                {topProducts.map((product) => (
                  <div
                    key={product.productId}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/productos/${product.productId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {product.code}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">{product.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-medium tabular-nums">
                        {formatCurrency(product.revenue)}
                      </div>
                      <div className="whitespace-nowrap text-xs text-muted-foreground">
                        {S.labels.orderCount(product.orderCount)} · {product.quantity} und.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ListCard>
          )}

          {isAdmin && (
            <ListCard
              title={S.tables.recentPayments}
              action={{ href: "/pagos", label: S.labels.seeAll }}
              isEmpty={data.recentPayments.length === 0}
              emptyLabel={S.empty.payments}
            >
              <div className="space-y-2">
                {data.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/pedidos/${payment.order.id}`}
                        className="text-primary hover:underline"
                      >
                        #{payment.order.orderNumber}
                      </Link>
                      <p className="truncate text-muted-foreground">
                        {payment.order.client.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-medium tabular-nums">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(payment.paymentDate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ListCard>
          )}

          <ListCard
            title={S.tables.inventory}
            action={{ href: "/inventario", label: S.labels.seeAll }}
            isEmpty={data.inventorySummary.length === 0}
            emptyLabel={S.empty.inventory}
          >
            <div className="space-y-3">
              {data.inventorySummary.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <StatusBadge status={item.status} type="inventory" />
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums">{item.units}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{S.labels.units}</span>
                  </div>
                </div>
              ))}
            </div>
          </ListCard>
        </div>
      </section>
    </div>
  );
}
