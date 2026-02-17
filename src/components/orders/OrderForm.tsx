"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { OrderItemRow } from "./OrderItemRow";
import { formatCurrency } from "@/lib/utils";
import { createOrder, updateOrder } from "@/lib/actions/orders";
import type { OrderFormData } from "@/lib/validations/order";
import { Plus, Loader2 } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
  salePrice: number | null;
  cost: number | null;
}

interface OrderFormProps {
  clients: ClientOption[];
  products: ProductOption[];
  initialData?: {
    id: string;
    clientId: string;
    orderDate: string;
    eventDate: string | null;
    deliveryDate: string | null;
    minDownpaymentPct: number;
    notes: string;
    items: {
      productId: string;
      quantity: number;
      unitPrice: number;
      costAmount: number;
    }[];
  };
}

const emptyItem = { productId: "", quantity: 1, unitPrice: 0, costAmount: 0 };

export function OrderForm({ clients, products, initialData }: OrderFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [clientId, setClientId] = useState(initialData?.clientId ?? "");
  const [orderDate, setOrderDate] = useState(
    initialData?.orderDate ?? new Date().toISOString().split("T")[0]
  );
  const [eventDate, setEventDate] = useState(initialData?.eventDate ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initialData?.deliveryDate ?? "");
  const [minPct, setMinPct] = useState(initialData?.minDownpaymentPct ?? 30);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [items, setItems] = useState<typeof emptyItem[]>(
    initialData?.items.length ? initialData.items : [{ ...emptyItem }]
  );

  const totalPrice = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.costAmount, 0);

  function handleItemChange(index: number, field: string, value: unknown) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientId) {
      toast.error("Seleccione un cliente");
      return;
    }
    if (items.some((i) => !i.productId)) {
      toast.error("Seleccione un producto para cada línea");
      return;
    }

    setSubmitting(true);

    const data: OrderFormData = {
      clientId,
      orderDate: new Date(orderDate),
      eventDate: eventDate ? new Date(eventDate) : null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      totalPrice,
      totalCost,
      minDownpaymentPct: minPct,
      notes,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        costSource: "MANUAL" as const,
        costAmount: i.costAmount,
      })),
    };

    const result = initialData
      ? await updateOrder(initialData.id, data)
      : await createOrder(data);

    setSubmitting(false);

    if (result.success) {
      toast.success(initialData ? "Pedido actualizado" : "Pedido creado exitosamente");
      if (initialData) {
        router.push(`/pedidos/${initialData.id}`);
      } else {
        router.push("/pedidos");
      }
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha del Pedido</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Fecha del Evento</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Entrega</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>% Abono Mínimo</Label>
              <Input type="number" min={0} max={100} value={minPct} onChange={(e) => setMinPct(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas del pedido..." rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <OrderItemRow
              key={index}
              index={index}
              item={item}
              products={products}
              onChange={handleItemChange}
              onRemove={removeItem}
            />
          ))}
          <Button type="button" variant="outline" onClick={addItem} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Producto
          </Button>
          <Separator />
          <div className="flex justify-end gap-8 text-sm">
            <div>
              <span className="text-muted-foreground">Total Precio: </span>
              <span className="font-bold text-lg">{formatCurrency(totalPrice)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Costo: </span>
              <span className="font-medium">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? "Guardar Cambios" : "Crear Pedido"}
        </Button>
      </div>
    </form>
  );
}
