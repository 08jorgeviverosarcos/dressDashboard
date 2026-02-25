"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";

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

interface OrderItemRowProps {
  index: number;
  item: {
    itemType: string;
    productId: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountType: string | null;
    discountValue: number | null;
    costAmount: number;
    rentalReturnDate: string;
    rentalDeposit: number;
  };
  products: ProductOption[];
  onChange: (index: number, field: string, value: unknown) => void;
  onRemove: (index: number) => void;
}

export function OrderItemRow({ index, item, products, onChange, onRemove }: OrderItemRowProps) {
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  const filteredProducts = products.filter((p) => {
    if (item.itemType === "SALE") return p.type === "SALE" || p.type === "BOTH";
    if (item.itemType === "RENTAL") return p.type === "RENTAL" || p.type === "BOTH";
    return false;
  });

  function handleTypeChange(newType: string) {
    onChange(index, "itemType", newType);
    onChange(index, "productId", "");
    onChange(index, "name", "");
    onChange(index, "description", "");
    onChange(index, "unitPrice", 0);
    onChange(index, "costAmount", 0);
    onChange(index, "rentalReturnDate", "");
    onChange(index, "rentalDeposit", 0);
  }

  function handleProductChange(productId: string) {
    const product = products.find((p) => p.id === productId);
    onChange(index, "productId", productId);
    if (product) {
      onChange(index, "name", product.name);
      onChange(index, "description", product.description ?? "");
      if (item.itemType === "RENTAL") {
        onChange(index, "unitPrice", product.rentalPrice ?? product.salePrice ?? 0);
        onChange(index, "costAmount", 0);
      } else {
        onChange(index, "unitPrice", product.salePrice ?? 0);
        onChange(index, "costAmount", product.cost ?? 0);
      }
    }
  }

  const lineTotal = item.quantity * item.unitPrice;
  const subtotal = (() => {
    if (item.discountType === "FIXED" && item.discountValue) {
      return lineTotal - item.discountValue;
    }
    if (item.discountType === "PERCENTAGE" && item.discountValue) {
      return lineTotal * (1 - item.discountValue / 100);
    }
    return lineTotal;
  })();

  const itemTypeLabel =
    item.itemType === "SALE"
      ? "Venta"
      : item.itemType === "RENTAL"
        ? "Alquiler"
        : "Servicio";

  const selectedProduct = products.find((p) => p.id === item.productId);

  const productColumns: EntitySelectorColumn<ProductOption>[] = [
    { key: "code", header: "Código", cell: (p) => p.code, className: "w-[100px]" },
    { key: "name", header: "Nombre", cell: (p) => p.name },
    { key: "type", header: "Tipo", cell: (p) => p.type, className: "hidden sm:table-cell" },
  ];

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">Item {index + 1}</p>
          <Badge variant="outline" className="text-[10px]">{itemTypeLabel}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} type="button">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Fila 1: Tipo + Producto/Nombre + Cantidad + Precio + Costo + Subtotal */}
      <div className="grid grid-cols-1 gap-2 items-end sm:grid-cols-2 md:grid-cols-12">
        <div className="sm:col-span-1 md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
          <Select value={item.itemType} onValueChange={handleTypeChange}>
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

        <div className="sm:col-span-1 md:col-span-4">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {item.itemType === "SERVICE" ? "Nombre" : "Producto"}
          </label>
          {item.itemType === "SERVICE" ? (
            <Input
              value={item.name}
              onChange={(e) => onChange(index, "name", e.target.value)}
              placeholder="Nombre del servicio..."
            />
          ) : (
            <>
              <EntitySelectorTrigger
                placeholder="Seleccionar..."
                displayValue={selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : undefined}
                onClick={() => setProductSelectorOpen(true)}
              />
              <EntitySelectorModal
                open={productSelectorOpen}
                onOpenChange={setProductSelectorOpen}
                title="Seleccionar Producto"
                searchPlaceholder="Buscar por código o nombre..."
                size="lg"
                items={filteredProducts}
                columns={productColumns}
                searchFilter={(p, q) => {
                  const lower = q.toLowerCase();
                  return p.code.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower);
                }}
                getItemId={(p) => p.id}
                selectedId={item.productId}
                onSelect={(p) => handleProductChange(p.id)}
              />
            </>
          )}
        </div>

        <div className="sm:col-span-1 md:col-span-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Cant.</label>
          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onChange(index, "quantity", Number(e.target.value))}
          />
        </div>

        <div className="sm:col-span-1 md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio Unit.</label>
          <MoneyInput
            value={item.unitPrice}
            onValueChange={(value) => onChange(index, "unitPrice", value ?? 0)}
          />
        </div>

        <div className="sm:col-span-1 md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo</label>
          <MoneyInput
            value={item.costAmount}
            onValueChange={(value) => onChange(index, "costAmount", value ?? 0)}
          />
        </div>

        <div className="sm:col-span-1 md:col-span-1 text-right">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Subtotal</label>
          <p className="text-sm font-semibold py-2 whitespace-nowrap">{formatCurrency(subtotal)}</p>
        </div>
      </div>

      {/* Fila 2: Descripcion + Descuento */}
      <div className="grid grid-cols-1 gap-2 items-end sm:grid-cols-2 md:grid-cols-12">
        <div className="sm:col-span-2 md:col-span-6">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
          {item.itemType === "SERVICE" ? (
            <Input
              value={item.description}
              onChange={(e) => onChange(index, "description", e.target.value)}
              placeholder="Descripción del servicio..."
            />
          ) : (
            <p className="text-xs text-muted-foreground py-2 min-h-[36px]">
              {item.description || "—"}
            </p>
          )}
        </div>

        <div className="sm:col-span-1 md:col-span-3">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo descuento</label>
          <Select
            value={item.discountType ?? "none"}
            onValueChange={(v) => {
              if (v === "none") {
                onChange(index, "discountType", null);
                onChange(index, "discountValue", null);
              } else {
                onChange(index, "discountType", v);
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

        <div className="sm:col-span-1 md:col-span-3">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {item.discountType === "PERCENTAGE" ? "Descuento (%)" : "Descuento ($)"}
          </label>
          {item.discountType === "PERCENTAGE" ? (
            <Input
              type="number"
              min={0}
              value={item.discountValue ?? 0}
              disabled={!item.discountType}
              onChange={(e) => onChange(index, "discountValue", Number(e.target.value))}
              placeholder="0"
            />
          ) : (
            <MoneyInput
              value={item.discountValue ?? 0}
              disabled={!item.discountType}
              onValueChange={(value) => onChange(index, "discountValue", value ?? 0)}
              placeholder="$0"
            />
          )}
        </div>
      </div>

      {/* Fila 3: Fechas de alquiler (solo para RENTAL) */}
      {item.itemType === "RENTAL" && (
        <div className="grid grid-cols-1 gap-2 items-end sm:grid-cols-2 md:grid-cols-12">
          <div className="sm:col-span-1 md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha Devolución</label>
            <Input
              type="date"
              value={item.rentalReturnDate}
              onChange={(e) => onChange(index, "rentalReturnDate", e.target.value)}
            />
          </div>
          <div className="sm:col-span-1 md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Depósito</label>
            <MoneyInput
              value={item.rentalDeposit}
              onValueChange={(value) => onChange(index, "rentalDeposit", value ?? 0)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
