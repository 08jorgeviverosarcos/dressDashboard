"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, PieChart, Pie, Label } from "recharts";
import { ORDER_STATUS_LABELS } from "@/lib/constants/categories";
import { formatCurrency } from "@/lib/utils";

const revenueExpenseConfig: ChartConfig = {
  revenue: { label: "Ingresos", color: "#16a34a" },
  expenses: { label: "Gastos", color: "#dc2626" },
};

const statusConfig: ChartConfig = {
  count: { label: "Pedidos", color: "hsl(var(--chart-3))" },
};

const salesConfig: ChartConfig = {
  sales: { label: "Ventas", color: "#2563eb" },
};

const debtConfig: ChartConfig = {
  paid: { label: "Abonado", color: "#16a34a" },
  pending: { label: "Pendiente", color: "#f59e0b" },
};

interface DashboardChartsProps {
  monthlyData: { month: string; revenue: number; expenses: number }[];
  ordersByStatus: { status: string; count: number }[];
  showFinancial?: boolean;
  salesMonthlyData?: { month: string; sales: number }[];
  salesSummary?: { totalSold: number; totalPaid: number; totalPending: number };
}

export function DashboardCharts({
  monthlyData,
  ordersByStatus,
  showFinancial = true,
  salesMonthlyData,
  salesSummary,
}: DashboardChartsProps) {
  const statusData = ordersByStatus.map((item) => ({
    status: ORDER_STATUS_LABELS[item.status] ?? item.status,
    count: item.count,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {showFinancial && (
        <Card>
          <CardHeader>
            <CardTitle>Ingresos vs Gastos (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueExpenseConfig} className="h-[300px] w-full">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pipeline de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={statusConfig} className="h-[300px] w-full">
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="status" fontSize={12} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {showFinancial && salesMonthlyData && salesMonthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={salesConfig} className="h-[300px] w-full">
              <BarChart data={salesMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {showFinancial && salesSummary && salesSummary.totalSold > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vendido vs Abonado</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={debtConfig} className="h-[300px] w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  }
                />
                <Pie
                  data={[
                    { name: "paid", value: salesSummary.totalPaid, fill: "var(--color-paid)" },
                    { name: "pending", value: salesSummary.totalPending, fill: "var(--color-pending)" },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  strokeWidth={2}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) - 10}
                              className="fill-foreground text-lg font-bold"
                            >
                              {formatCurrency(salesSummary.totalSold)}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 14}
                              className="fill-muted-foreground text-xs"
                            >
                              Total Vendido
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
