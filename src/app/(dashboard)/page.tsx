import { getDashboardData, getTopProducts } from "@/lib/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { verifySession } from "@/lib/dal";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  ShoppingBag,
  BarChart3,
  Calendar,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { DashboardCharts } from "./dashboard-charts";
import { DashboardFilters } from "./dashboard-filters";

interface Props {
  searchParams: Promise<{
    month?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
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
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 0, 23, 59, 59),
  };
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await verifySession();
  const isAdmin = session.role === "ADMIN";

  const params = await searchParams;
  const startDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);
  const monthRange = getDateRangeFromMonth(params.month);

  const rangeStart = startDate ?? monthRange.start;
  const rangeEnd = endDate ?? monthRange.end;

  const [data, topProducts] = await Promise.all([
    getDashboardData(rangeStart, rangeEnd),
    getTopProducts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel</h1>
        <p className="text-muted-foreground">Resumen general del negocio</p>
      </div>

      {isAdmin && <DashboardFilters />}

      {/* KPI Cards */}
      <div className={`grid gap-4 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
        {isAdmin && (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Ingresos (mes)
                </div>
                <div className="text-2xl font-bold">{formatCurrency(data.kpis.totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="h-4 w-4" />
                  Gastos (mes)
                </div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(data.kpis.totalExpenses)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Flujo Neto
                </div>
                <div className={`text-2xl font-bold ${data.kpis.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(data.kpis.netCashFlow)}
                </div>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingBag className="h-4 w-4" />
              Pedidos en Pipeline
            </div>
            <div className="text-2xl font-bold">{data.kpis.pipelineOrders}</div>
          </CardContent>
        </Card>
        {isAdmin && (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Ganancia (mes)
                </div>
                <div className={`text-2xl font-bold ${data.kpis.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(data.kpis.totalProfit)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                  Total Vendido
                </div>
                <div className="text-2xl font-bold">{formatCurrency(data.kpis.totalSold)}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <DashboardCharts
        monthlyData={data.monthlyData}
        ordersByStatus={data.ordersByStatus}
        showFinancial={isAdmin}
        salesMonthlyData={data.salesMonthlyData}
        salesSummary={data.salesSummary}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Productos por Ingreso</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{p.code}</span>
                      <span className="text-sm text-muted-foreground ml-2">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(p.revenue)}</div>
                      <div className="text-xs text-muted-foreground">{p.orderCount} pedidos</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos próximos</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Link href={`/pedidos/${event.id}`} className="text-primary hover:underline font-medium">
                        #{event.orderNumber}
                      </Link>
                      <span className="text-sm text-muted-foreground ml-2">{event.client.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{event.eventDate ? formatDate(event.eventDate) : "—"}</span>
                      <StatusBadge status={event.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Pagos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos recientes</p>
            ) : (
              <div className="space-y-2">
                {data.recentPayments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link href={`/pedidos/${payment.order.id}`} className="text-primary hover:underline">
                        #{payment.order.orderNumber}
                      </Link>
                      <span className="ml-2 text-muted-foreground">{payment.order.client.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(payment.amount)}</span>
                      <span className="ml-2 text-muted-foreground">{formatDate(payment.paymentDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            {data.inventorySummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de inventario</p>
            ) : (
              <div className="space-y-3">
                {data.inventorySummary.map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <StatusBadge status={item.status} type="inventory" />
                    <span className="text-lg font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
