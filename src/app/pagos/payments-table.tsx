"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/constants/categories";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deletePayment } from "@/lib/actions/payments";
import { Trash2 } from "lucide-react";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const methods = ["ALL", ...Object.keys(PAYMENT_METHOD_LABELS)];

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deletePayment(deletingId);
    setDeleteLoading(false);
    setDeletingId(null);
    if (result.success) {
      toast.success("Pago eliminado");
    } else {
      toast.error(result.error);
    }
  }

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
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingId(row.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <SearchInput placeholder="Buscar por cliente o # de pedido..." />

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

        <DataTable
          columns={columns}
          data={payments}
          onRowClick={(row) => router.push(`/pagos/${row.id}`)}
          emptyMessage="No se encontraron pagos"
        />
      </div>
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Eliminar pago"
        description="¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
