"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/constants/categories";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";

interface Payment {
  id: string;
  paymentDate: string | Date;
  amount: number | string;
  paymentType: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

interface PaymentTimelineProps {
  payments: Payment[];
  totalPrice: number;
}

export function PaymentTimeline({ payments, totalPrice }: PaymentTimelineProps) {
  let runningTotal = 0;

  return (
    <div className="space-y-3">
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
      ) : (
        payments.map((payment) => {
          runningTotal += Number(payment.amount);
          const pct = totalPrice > 0 ? (runningTotal / totalPrice) * 100 : 0;

          return (
            <div key={payment.id} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="rounded-full bg-primary/10 p-2">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  <span className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}
                  </Badge>
                </div>
                {payment.reference && (
                  <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                )}
                {payment.notes && (
                  <p className="text-xs text-muted-foreground">{payment.notes}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
