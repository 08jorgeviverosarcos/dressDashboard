"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ORDER_STATUS_LABELS } from "@/lib/constants/categories";

const revenueExpenseConfig: ChartConfig = {
  revenue: { label: "Ingresos", color: "hsl(var(--chart-1))" },
  expenses: { label: "Gastos", color: "hsl(var(--chart-2))" },
};

const statusConfig: ChartConfig = {
  count: { label: "Pedidos", color: "hsl(var(--chart-3))" },
};

interface DashboardChartsProps {
  monthlyData: { month: string; revenue: number; expenses: number }[];
  ordersByStatus: { status: string; count: number }[];
}

export function DashboardCharts({ monthlyData, ordersByStatus }: DashboardChartsProps) {
  const statusData = ordersByStatus.map((item) => ({
    status: ORDER_STATUS_LABELS[item.status] ?? item.status,
    count: item.count,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
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
    </div>
  );
}
