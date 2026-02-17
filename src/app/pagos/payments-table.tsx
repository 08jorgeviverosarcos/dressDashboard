"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/constants/categories";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PaymentRow {
  id: string;
  paymentDate: string;
  amount: number | string;
  paymentType: string;
  paymentMethod: string;
  reference: string | null;
  order: {
    id: string;
    orderNumber: number;
    client: { name: string };
  };
}

interface PaymentsTableProps {
  payments: PaymentRow[];
  currentMethod?: string;
}

export function PaymentsTable({ payments, currentMethod }: PaymentsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const methods = ["ALL", ...Object.keys(PAYMENT_METHOD_LABELS)];

  function handleMethodFilter(method: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (method === "ALL") {
      params.delete("method");
    } else {
      params.set("method", method);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleDateChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  const columns: Column<PaymentRow>[] = [
    { key: "date", header: "Fecha", cell: (row) => formatDate(row.paymentDate) },
    {
      key: "order",
      header: "Pedido",
      cell: (row) => (
        <Link href={`/pedidos/${row.order.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          #{row.order.orderNumber}
        </Link>
      ),
    },
    { key: "client", header: "Cliente", cell: (row) => row.order.client.name },
    { key: "amount", header: "Monto", cell: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span>, className: "text-right" },
    {
      key: "type",
      header: "Tipo",
      cell: (row) => (
        <Badge variant="secondary">{PAYMENT_TYPE_LABELS[row.paymentType] ?? row.paymentType}</Badge>
      ),
    },
    {
      key: "method",
      header: "Método",
      cell: (row) => (
        <Badge variant="outline">{PAYMENT_METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}</Badge>
      ),
    },
    { key: "ref", header: "Referencia", cell: (row) => row.reference ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            className="w-40"
            defaultValue={searchParams.get("startDate") ?? ""}
            onChange={(e) => handleDateChange("startDate", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            className="w-40"
            defaultValue={searchParams.get("endDate") ?? ""}
            onChange={(e) => handleDateChange("endDate", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <Badge
            key={method}
            variant={(currentMethod ?? "ALL") === method ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => handleMethodFilter(method)}
          >
            {method === "ALL" ? "Todos" : PAYMENT_METHOD_LABELS[method]}
          </Badge>
        ))}
      </div>

      <DataTable columns={columns} data={payments} emptyMessage="No se encontraron pagos" />
    </div>
  );
}
