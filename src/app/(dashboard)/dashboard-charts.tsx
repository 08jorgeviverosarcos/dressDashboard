"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants/categories";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";
import { DASHBOARD_STRINGS as S } from "@/features/dashboard/dashboard.strings";

/**
 * Paleta validada con el validador de contraste/daltonismo (dataviz):
 * azul ↔ rojo y azul ↔ naranja pasan todas las verificaciones en claro y
 * oscuro. El verde/rojo anterior fallaba la separación deuteranope (ΔE 5.0).
 */
const SERIES_BLUE = { light: "#2a78d6", dark: "#3987e5" } as const;
const SERIES_RED = { light: "#e34948", dark: "#e66767" } as const;
const SERIES_ORANGE = { light: "#eb6834", dark: "#d95926" } as const;

const cashflowConfig: ChartConfig = {
  revenue: { label: S.charts.revenue, theme: SERIES_BLUE },
  expenses: { label: S.charts.expenses, theme: SERIES_RED },
};

const salesConfig: ChartConfig = {
  sales: { label: S.charts.salesSeries, theme: SERIES_BLUE },
};

const countConfig: ChartConfig = {
  count: { label: S.charts.orders, theme: SERIES_BLUE },
};

const amountConfig: ChartConfig = {
  amount: { label: S.charts.amount, theme: SERIES_BLUE },
};

const debtConfig: ChartConfig = {
  paid: { label: S.charts.paid, theme: SERIES_BLUE },
  pending: { label: S.charts.pending, theme: SERIES_ORANGE },
};

interface ChartCardProps {
  title: string;
  hint?: string;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}

function ChartCard({ title, hint, isEmpty, emptyLabel, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

interface RankedBarChartProps {
  data: { name: string; amount: number }[];
}

/** Barras horizontales ordenadas: un solo tono, magnitud comparada, valor rotulado. */
function RankedBarChart({ data }: RankedBarChartProps) {
  const height = Math.max(180, data.length * 44 + 24);

  return (
    <ChartContainer config={amountConfig} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 72, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={116}
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />}
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList
            dataKey="amount"
            position="right"
            offset={8}
            className="fill-muted-foreground"
            fontSize={11}
            formatter={(value: number) => formatCompactCurrency(value)}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

interface DashboardChartsProps {
  monthlyData: { month: string; revenue: number; expenses: number }[];
  salesMonthlyData: { month: string; sales: number }[];
  ordersByStatus: { status: string; count: number }[];
  expensesByCategory: { name: string; amount: number }[];
  paymentsByMethod: { name: string; amount: number }[];
  salesSummary: { totalSold: number; totalPaid: number; totalPending: number };
  showFinancial?: boolean;
}

export function DashboardCharts({
  monthlyData,
  salesMonthlyData,
  ordersByStatus,
  expensesByCategory,
  paymentsByMethod,
  salesSummary,
  showFinancial = true,
}: DashboardChartsProps) {
  const statusData = ordersByStatus.map((item) => ({
    status: ORDER_STATUS_LABELS[item.status] ?? item.status,
    count: item.count,
  }));

  const methodData = paymentsByMethod.map((item) => ({
    name: PAYMENT_METHOD_LABELS[item.name] ?? item.name,
    amount: item.amount,
  }));

  const hasCashflow = monthlyData.some((m) => m.revenue > 0 || m.expenses > 0);
  const hasSales = salesMonthlyData.some((m) => m.sales > 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {showFinancial && (
        <ChartCard
          title={S.charts.revenueVsExpenses}
          hint={S.charts.revenueVsExpensesHint}
          isEmpty={!hasCashflow}
          emptyLabel={S.empty.generic}
        >
          <ChartContainer config={cashflowConfig} className="h-[280px] w-full">
            <BarChart data={monthlyData} barGap={2} margin={{ left: 4, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                width={52}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompactCurrency(v as number)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      )}

      {showFinancial && (
        <ChartCard
          title={S.charts.sales}
          hint={S.charts.salesHint}
          isEmpty={!hasSales}
          emptyLabel={S.empty.generic}
        >
          <ChartContainer config={salesConfig} className="h-[280px] w-full">
            <BarChart data={salesMonthlyData} margin={{ left: 4, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                width={52}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompactCurrency(v as number)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />
                }
              />
              <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} barSize={36} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      )}

      {showFinancial && (
        <ChartCard
          title={S.charts.expensesByCategory}
          isEmpty={expensesByCategory.length === 0}
          emptyLabel={S.empty.expenses}
        >
          <RankedBarChart data={expensesByCategory} />
        </ChartCard>
      )}

      {showFinancial && (
        <ChartCard
          title={S.charts.paymentsByMethod}
          isEmpty={methodData.length === 0}
          emptyLabel={S.empty.payments}
        >
          <RankedBarChart data={methodData} />
        </ChartCard>
      )}

      <ChartCard
        title={S.charts.pipeline}
        hint={S.charts.pipelineHint}
        isEmpty={statusData.length === 0}
        emptyLabel={S.empty.generic}
      >
        <ChartContainer config={countConfig} className="h-[280px] w-full">
          <BarChart
            data={statusData}
            layout="vertical"
            margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="status"
              width={100}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20}>
              <LabelList
                dataKey="count"
                position="right"
                offset={8}
                className="fill-muted-foreground"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {showFinancial && (
        <ChartCard
          title={S.charts.soldVsPaid}
          hint={S.charts.soldVsPaidHint}
          isEmpty={salesSummary.totalSold <= 0}
          emptyLabel={S.empty.products}
        >
          <ChartContainer config={debtConfig} className="h-[280px] w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />
                }
              />
              <Pie
                data={[
                  { name: "paid", value: salesSummary.totalPaid, fill: "var(--color-paid)" },
                  { name: "pending", value: salesSummary.totalPending, fill: "var(--color-pending)" },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={98}
                paddingAngle={2}
                strokeWidth={2}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
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
                            {S.charts.totalSold}
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
        </ChartCard>
      )}
    </div>
  );
}
