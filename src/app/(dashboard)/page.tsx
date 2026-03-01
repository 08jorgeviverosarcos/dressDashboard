import { getDashboardData, getTopProducts } from "@/lib/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  ShoppingBag,
  BarChart3,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { DashboardCharts } from "./dashboard-charts";

export default async function DashboardPage() {
  const [data, topProducts] = await Promise.all([
    getDashboardData(),
    getTopProducts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel</h1>
        <p className="text-muted-foreground">Resumen general del negocio</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingBag className="h-4 w-4" />
              Pedidos en Pipeline
            </div>
            <div className="text-2xl font-bold">{data.kpis.pipelineOrders}</div>
          </CardContent>
        </Card>
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
      </div>

      {/* Charts */}
      <DashboardCharts
        monthlyData={data.monthlyData}
        ordersByStatus={data.ordersByStatus}
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
