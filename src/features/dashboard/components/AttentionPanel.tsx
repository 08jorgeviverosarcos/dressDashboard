import Link from "next/link";
import {
  AlertTriangle,
  CalendarX,
  CheckCircle2,
  CircleDollarSign,
  PackageX,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DASHBOARD_STRINGS as S } from "../dashboard.strings";

type Severity = "critical" | "serious" | "warning";

const severityClasses: Record<Severity, string> = {
  critical: "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300",
  serious: "border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-300",
  warning: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
};

interface AttentionItem {
  key: string;
  href: string;
  label: string;
  detail: string;
}

interface AttentionGroup {
  id: string;
  icon: LucideIcon;
  severity: Severity;
  title: string;
  description: string;
  count: number;
  amount?: number;
  items: AttentionItem[];
}

interface OrderAlert {
  id: string;
  orderNumber: number;
  clientName: string;
  balance: number;
  total: number;
  paid: number;
}

interface RentalAlert {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  clientName: string;
  productCode: string | null;
  productName: string;
  returnDate: Date | null;
  daysOverdue: number | null;
}

interface EventAlert {
  id: string;
  orderNumber: number;
  clientName: string;
  eventDate: Date | null;
  daysOverdue: number;
}

interface AttentionPanelProps {
  overdueRentals: RentalAlert[];
  deliveredWithBalance: OrderAlert[];
  belowMinDownpayment: OrderAlert[];
  overdueEvents: EventAlert[];
  inconsistentOrders: OrderAlert[];
}

const MAX_ITEMS = 4;

function orderItems(orders: OrderAlert[]): AttentionItem[] {
  return orders.slice(0, MAX_ITEMS).map((order) => ({
    key: order.id,
    href: `/pedidos/${order.id}`,
    label: `#${order.orderNumber}`,
    detail: `${order.clientName} · ${formatCurrency(order.balance)}`,
  }));
}

export function AttentionPanel({
  overdueRentals,
  deliveredWithBalance,
  belowMinDownpayment,
  overdueEvents,
  inconsistentOrders,
}: AttentionPanelProps) {
  const groups: AttentionGroup[] = [];

  if (overdueRentals.length > 0) {
    groups.push({
      id: "overdue-rentals",
      icon: PackageX,
      severity: "critical",
      title: S.alerts.overdueRentals.title,
      description: S.alerts.overdueRentals.description,
      count: overdueRentals.length,
      items: overdueRentals.slice(0, MAX_ITEMS).map((rental) => ({
        key: rental.id,
        href: rental.orderId ? `/pedidos/${rental.orderId}` : "/pedidos",
        label: rental.orderNumber ? `#${rental.orderNumber}` : rental.productName,
        detail: [
          rental.productCode,
          rental.clientName,
          S.labels.daysLate(rental.daysOverdue ?? 0),
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    });
  }

  if (deliveredWithBalance.length > 0) {
    groups.push({
      id: "delivered-with-balance",
      icon: CircleDollarSign,
      severity: "critical",
      title: S.alerts.deliveredWithBalance.title,
      description: S.alerts.deliveredWithBalance.description,
      count: deliveredWithBalance.length,
      amount: deliveredWithBalance.reduce((sum, o) => sum + o.balance, 0),
      items: orderItems(deliveredWithBalance),
    });
  }

  if (belowMinDownpayment.length > 0) {
    groups.push({
      id: "below-min-downpayment",
      icon: Scale,
      severity: "serious",
      title: S.alerts.belowMinDownpayment.title,
      description: S.alerts.belowMinDownpayment.description,
      count: belowMinDownpayment.length,
      amount: belowMinDownpayment.reduce((sum, o) => sum + o.balance, 0),
      items: orderItems(belowMinDownpayment),
    });
  }

  if (overdueEvents.length > 0) {
    groups.push({
      id: "overdue-events",
      icon: CalendarX,
      severity: "serious",
      title: S.alerts.overdueEvents.title,
      description: S.alerts.overdueEvents.description,
      count: overdueEvents.length,
      items: overdueEvents.slice(0, MAX_ITEMS).map((event) => ({
        key: event.id,
        href: `/pedidos/${event.id}`,
        label: `#${event.orderNumber}`,
        detail: `${event.clientName} · ${event.eventDate ? formatDate(event.eventDate) : S.labels.noDate}`,
      })),
    });
  }

  if (inconsistentOrders.length > 0) {
    groups.push({
      id: "inconsistent-orders",
      icon: AlertTriangle,
      severity: "warning",
      title: S.alerts.inconsistentOrders.title,
      description: S.alerts.inconsistentOrders.description,
      count: inconsistentOrders.length,
      items: inconsistentOrders.slice(0, MAX_ITEMS).map((order) => ({
        key: order.id,
        href: `/pedidos/${order.id}`,
        label: `#${order.orderNumber}`,
        detail: `${S.labels.balance} ${formatCurrency(order.balance)} · total ${formatCurrency(order.total)} / pagado ${formatCurrency(order.paid)}`,
      })),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {S.sections.alerts}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {S.alerts.allClear}
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const Icon = group.icon;
              const remaining = group.count - group.items.length;

              return (
                <div
                  key={group.id}
                  className={`rounded-lg border p-3 ${severityClasses[group.severity]}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{group.title}</p>
                        <p className="text-xs text-foreground/70">{group.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                      <Badge variant="secondary" className="tabular-nums">
                        {group.count}
                      </Badge>
                      {group.amount !== undefined && (
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(group.amount)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 pl-6">
                    {group.items.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:border-primary/60"
                      >
                        <span className="font-medium">{item.label}</span>
                        <span className="ml-1 text-muted-foreground">{item.detail}</span>
                      </Link>
                    ))}
                    {remaining > 0 && (
                      <span className="px-2 py-1 text-xs text-foreground/70">
                        +{remaining} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
