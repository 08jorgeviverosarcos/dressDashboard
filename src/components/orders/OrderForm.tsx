"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
import { ClientQuickForm } from "@/features/clients/components/ClientQuickForm";
import { MoneyInput } from "@/components/shared/MoneyInput";
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
  type: string;
  inventoryTracking: "UNIT" | "QUANTITY";
  salePrice: number | null;
  rentalPrice: number | null;
  cost: number | null;
  description: string | null;
}

interface InventoryItemOption {
  id: string;
  assetCode: string | null;
  productId: string;
  status: string;
}

interface OrderFormProps {
  clients: ClientOption[];
  products: ProductOption[];
  inventoryItems: InventoryItemOption[];
  initialData?: {
    id: string;
    orderNumber: number;
    clientId: string;
    orderDate: string;
    eventDate: string | null;
    deliveryDate: string | null;
    adjustmentAmount: number;
    adjustmentReason: string;
    minDownpaymentPct: number;
    notes: string;
    items: {
      id: string;
      itemType: string;
      productId: string;
      inventoryItemId: string | null;
      name: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountType: string | null;
      discountValue: number | null;
      costAmount: number;
      rentalReturnDate: string;
      rentalDeposit: number;
    }[];
  };
}

const emptyItem = {
  id: undefined as string | undefined,
  itemType: "SALE" as string,
  productId: "",
  inventoryItemId: null as string | null,
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  discountType: null as string | null,
  discountValue: null as number | null,
  costAmount: 0,
  rentalReturnDate: "",
  rentalDeposit: 0,
};

export function OrderForm({ clients, products, inventoryItems, initialData }: OrderFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [orderNumber, setOrderNumber] = useState<number | "">(initialData?.orderNumber ?? "");
  const [clientId, setClientId] = useState(initialData?.clientId ?? "");
  const [clientName, setClientName] = useState(
    initialData ? (clients.find((c) => c.id === initialData.clientId)?.name ?? "") : ""
  );
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [orderDate, setOrderDate] = useState(
    initialData?.orderDate ?? new Date().toISOString().split("T")[0]
  );
  const [eventDate, setEventDate] = useState(initialData?.eventDate ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initialData?.deliveryDate ?? "");
  const [adjustmentAmount, setAdjustmentAmount] = useState(initialData?.adjustmentAmount ?? 0);
  const [adjustmentReason, setAdjustmentReason] = useState(initialData?.adjustmentReason ?? "");
  const [minPct, setMinPct] = useState(initialData?.minDownpaymentPct ?? 30);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [items, setItems] = useState<typeof emptyItem[]>(
    initialData?.items.length
      ? initialData.items.map((i) => ({
          id: i.id,
          itemType: i.itemType,
          productId: i.productId,
          inventoryItemId: i.inventoryItemId ?? null,
          name: i.name,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountType: i.discountType,
          discountValue: i.discountValue,
          costAmount: i.costAmount,
          rentalReturnDate: i.rentalReturnDate,
          rentalDeposit: i.rentalDeposit,
        }))
      : [{ ...emptyItem }]
  );

  const itemsSubtotal = items.reduce((sum, i) => {
    const lineTotal = i.quantity * i.unitPrice;
    if (i.discountType === "FIXED" && i.discountValue) {
      return sum + lineTotal - i.discountValue;
    }
    if (i.discountType === "PERCENTAGE" && i.discountValue) {
      return sum + lineTotal * (1 - i.discountValue / 100);
    }
    return sum + lineTotal;
  }, 0);
  const totalPrice = itemsSubtotal + adjustmentAmount;
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

    if (!orderNumber) {
      toast.error("Ingrese el número de pedido");
      return;
    }
    if (!clientId) {
      toast.error("Seleccione un cliente");
      return;
    }
    if (items.some((i) => (i.itemType === "SALE" || i.itemType === "RENTAL") && !i.productId)) {
      toast.error("Seleccione un producto para cada item de venta o alquiler");
      return;
    }
    if (items.some((i) => !i.name)) {
      toast.error("Ingrese un nombre para cada item");
      return;
    }

    setSubmitting(true);

    const data: OrderFormData = {
      orderNumber: Number(orderNumber),
      clientId,
      orderDate: new Date(orderDate),
      eventDate: eventDate ? new Date(eventDate) : null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      totalPrice,
      totalCost,
      adjustmentAmount,
      adjustmentReason,
      minDownpaymentPct: minPct,
      notes,
      items: items.map((i) => ({
        id: i.id || undefined,
        itemType: i.itemType as "SALE" | "RENTAL" | "SERVICE",
        productId: i.productId || null,
        inventoryItemId: i.inventoryItemId || null,
        name: i.name,
        description: i.description || null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountType: i.discountType as "FIXED" | "PERCENTAGE" | null,
        discountValue: i.discountValue,
        costSource: "MANUAL" as const,
        costAmount: i.costAmount,
        rentalReturnDate: i.rentalReturnDate ? new Date(i.rentalReturnDate) : null,
        rentalDeposit: i.itemType === "RENTAL" ? i.rentalDeposit : null,
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

  const clientColumns: EntitySelectorColumn<ClientOption>[] = [
    { key: "name", header: "Nombre", cell: (c) => c.name },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label># Pedido *</Label>
              <Input
                type="number"
                min={1}
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value ? Number(e.target.value) : "")}
                placeholder="Ej: 471"
                disabled={!!initialData}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <EntitySelectorTrigger
                placeholder="Seleccionar cliente..."
                displayValue={clientName || undefined}
                onClick={() => setClientSelectorOpen(true)}
                onClear={() => { setClientId(""); setClientName(""); }}
              />
              <EntitySelectorModal
                open={clientSelectorOpen}
                onOpenChange={setClientSelectorOpen}
                title="Seleccionar Cliente"
                searchPlaceholder="Buscar por nombre..."
                items={clients}
                columns={clientColumns}
                searchFilter={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
                getItemId={(c) => c.id}
                selectedId={clientId}
                onSelect={(c) => { setClientId(c.id); setClientName(c.name); }}
                allowCreate
                createLabel="Crear cliente"
                renderCreateForm={({ onCreated, onCancel }) => (
                  <ClientQuickForm
                    onCreated={(c) => { setClientId(c.id); setClientName(c.name); onCreated(c); }}
                    onCancel={onCancel}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha del Pedido</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha del Evento</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Entrega</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ajuste ($)</Label>
              <MoneyInput value={adjustmentAmount} onValueChange={(value) => setAdjustmentAmount(value ?? 0)} />
            </div>
            <div className="space-y-2">
              <Label>Motivo del ajuste</Label>
              <Input
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Ej: multa, domicilio, recargo..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
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
          <CardTitle>Items del Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <OrderItemRow
              key={index}
              index={index}
              item={item}
              products={products}
              inventoryItems={inventoryItems}
              onChange={handleItemChange}
              onRemove={removeItem}
            />
          ))}
          <Button type="button" variant="outline" onClick={addItem} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Item
          </Button>
          <Separator />
          <div className="flex flex-wrap justify-end gap-8 rounded-md border bg-muted/20 px-4 py-3 text-sm">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
