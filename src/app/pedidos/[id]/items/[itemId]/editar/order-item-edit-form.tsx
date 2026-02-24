"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { updateOrderItem } from "@/lib/actions/orders";

interface ProductOption {
  id: string;
  code: string;
  name: string;
  type: string;
  salePrice: number | null;
  rentalPrice: number | null;
  cost: number | null;
  description: string | null;
}

interface OrderItemEditFormProps {
  orderItemId: string;
  orderId: string;
  products: ProductOption[];
  initialValues: {
    itemType: string;
    productId: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountType: string | null;
    discountValue: number | null;
    costAmount: number;
    costSource: string;
    inventoryItemId: string | null;
    notes: string;
    rentalReturnDate: string;
    rentalDeposit: number;
  };
}

export function OrderItemEditForm({
  orderItemId,
  orderId,
  products,
  initialValues,
}: OrderItemEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [itemType, setItemType] = useState(initialValues.itemType);
  const [productId, setProductId] = useState(initialValues.productId);
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [quantity, setQuantity] = useState(initialValues.quantity);
  const [unitPrice, setUnitPrice] = useState(initialValues.unitPrice);
  const [discountType, setDiscountType] = useState<string | null>(initialValues.discountType);
  const [discountValue, setDiscountValue] = useState<number | null>(initialValues.discountValue);
  const [costAmount, setCostAmount] = useState(initialValues.costAmount);
  const [rentalReturnDate, setRentalReturnDate] = useState(initialValues.rentalReturnDate);
  const [rentalDeposit, setRentalDeposit] = useState(initialValues.rentalDeposit);

  const filteredProducts = products.filter((p) => {
    if (itemType === "SALE") return p.type === "SALE" || p.type === "BOTH";
    if (itemType === "RENTAL") return p.type === "RENTAL" || p.type === "BOTH";
    return false;
  });

  function handleTypeChange(newType: string) {
    setItemType(newType);
    setProductId("");
    setName("");
    setDescription("");
    setUnitPrice(0);
    setCostAmount(0);
    setRentalReturnDate("");
    setRentalDeposit(0);
  }

  function handleProductChange(pid: string) {
    const product = products.find((p) => p.id === pid);
    setProductId(pid);
    if (product) {
      setName(product.name);
      setDescription(product.description ?? "");
      if (itemType === "RENTAL") {
        setUnitPrice(product.rentalPrice ?? product.salePrice ?? 0);
        setCostAmount(0);
      } else {
        setUnitPrice(product.salePrice ?? 0);
        setCostAmount(product.cost ?? 0);
      }
    }
  }

  const lineTotal = quantity * unitPrice;
  const subtotal = (() => {
    if (discountType === "FIXED" && discountValue) return lineTotal - discountValue;
    if (discountType === "PERCENTAGE" && discountValue) return lineTotal * (1 - discountValue / 100);
    return lineTotal;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await updateOrderItem(orderItemId, {
      itemType: itemType as "SALE" | "RENTAL" | "SERVICE",
      productId: productId || null,
      inventoryItemId: initialValues.inventoryItemId || null,
      name,
      description: description || null,
      quantity,
      unitPrice,
      discountType: discountType as "FIXED" | "PERCENTAGE" | null,
      discountValue: discountValue ?? null,
      costSource: initialValues.costSource as "INVENTORY" | "EXPENSES" | "MANUAL",
      costAmount,
      notes: initialValues.notes || undefined,
      rentalReturnDate: rentalReturnDate ? new Date(rentalReturnDate) : null,
      rentalDeposit: itemType === "RENTAL" ? rentalDeposit : null,
    });

    setLoading(false);
    if (result.success) {
      toast.success("Item actualizado");
      router.push(`/pedidos/${orderId}/items/${orderItemId}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={itemType} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALE">Venta</SelectItem>
                  <SelectItem value="RENTAL">Alquiler</SelectItem>
                  <SelectItem value="SERVICE">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Producto / Nombre */}
            <div className="space-y-2">
              <Label>{itemType === "SERVICE" ? "Nombre" : "Producto"}</Label>
              {itemType === "SERVICE" ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del servicio..."
                  required
                />
              ) : (
                <Select value={productId} onValueChange={handleProductChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label>Descripción</Label>
            {itemType === "SERVICE" ? (
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del servicio..."
              />
            ) : (
              <p className="text-sm text-muted-foreground py-2 min-h-[36px] border rounded-md px-3">
                {description || "—"}
              </p>
            )}
          </div>

          {/* Cantidad + Precio + Costo */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Precio unitario</Label>
              <MoneyInput value={unitPrice} onValueChange={(value) => setUnitPrice(value ?? 0)} />
            </div>
            <div className="space-y-2">
              <Label>Costo</Label>
              <MoneyInput value={costAmount} onValueChange={(value) => setCostAmount(value ?? 0)} />
            </div>
          </div>

          {/* Descuento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de descuento</Label>
              <Select
                value={discountType ?? "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    setDiscountType(null);
                    setDiscountValue(null);
                  } else {
                    setDiscountType(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin descuento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin descuento</SelectItem>
                  <SelectItem value="FIXED">Monto fijo ($)</SelectItem>
                  <SelectItem value="PERCENTAGE">Porcentaje (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {discountType === "PERCENTAGE" ? "Descuento (%)" : "Descuento ($)"}
              </Label>
              {discountType === "PERCENTAGE" ? (
                <Input
                  type="number"
                  min={0}
                  value={discountValue ?? 0}
                  disabled={!discountType}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                />
              ) : (
                <MoneyInput
                  value={discountValue ?? 0}
                  disabled={!discountType}
                  onValueChange={(value) => setDiscountValue(value ?? 0)}
                />
              )}
            </div>
          </div>

          {/* Fecha devolución (solo RENTAL) */}
          {itemType === "RENTAL" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 max-w-xs">
                <Label>Fecha de Devolución</Label>
                <Input
                  type="date"
                  value={rentalReturnDate}
                  onChange={(e) => setRentalReturnDate(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-w-xs">
                <Label>Depósito</Label>
                <MoneyInput
                  value={rentalDeposit}
                  onValueChange={(value) => setRentalDeposit(value ?? 0)}
                />
              </div>
            </div>
          )}

          {/* Subtotal preview */}
          <div className="flex justify-end border-t pt-4">
            <div className="text-sm text-muted-foreground mr-4">Subtotal</div>
            <div className="font-bold">{formatCurrency(subtotal)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/pedidos/${orderId}/items/${orderItemId}`)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
