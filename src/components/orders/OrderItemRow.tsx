"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
    rentalPickupDate: string;
    rentalReturnDate: string;
  };
  products: ProductOption[];
  onChange: (index: number, field: string, value: unknown) => void;
  onRemove: (index: number) => void;
}

export function OrderItemRow({ index, item, products, onChange, onRemove }: OrderItemRowProps) {
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
    onChange(index, "rentalPickupDate", "");
    onChange(index, "rentalReturnDate", "");
  }

  function handleProductChange(productId: string) {
    const product = products.find((p) => p.id === productId);
    onChange(index, "productId", productId);
    if (product) {
      onChange(index, "name", product.name);
      onChange(index, "description", product.description ?? "");
      if (item.itemType === "RENTAL") {
        onChange(index, "unitPrice", product.rentalPrice ?? product.salePrice ?? 0);
      } else {
        onChange(index, "unitPrice", product.salePrice ?? 0);
      }
      onChange(index, "costAmount", product.cost ?? 0);
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

  return (
    <div className="space-y-2 rounded-md border p-3">
      {/* Fila 1: Tipo + Producto/Nombre + Cantidad + Precio + Costo + Subtotal + Eliminar */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-2">
          {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>}
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

        <div className="col-span-4">
          {index === 0 && (
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {item.itemType === "SERVICE" ? "Nombre" : "Producto"}
            </label>
          )}
          {item.itemType === "SERVICE" ? (
            <Input
              value={item.name}
              onChange={(e) => onChange(index, "name", e.target.value)}
              placeholder="Nombre del servicio..."
            />
          ) : (
            <Select value={item.productId} onValueChange={handleProductChange}>
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

        <div className="col-span-1">
          {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">Cant.</label>}
          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onChange(index, "quantity", Number(e.target.value))}
          />
        </div>

        <div className="col-span-2">
          {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio Unit.</label>}
          <Input
            type="number"
            value={item.unitPrice}
            onChange={(e) => onChange(index, "unitPrice", Number(e.target.value))}
          />
        </div>

        <div className="col-span-2">
          {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo</label>}
          <Input
            type="number"
            value={item.costAmount}
            onChange={(e) => onChange(index, "costAmount", Number(e.target.value))}
          />
        </div>

        <div className="col-span-1 text-right">
          {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">Subtotal</label>}
          <p className="text-sm font-medium py-2">{formatCurrency(subtotal)}</p>
        </div>

        <div className="col-span-1 flex justify-end">
          {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">&nbsp;</label>}
          <Button variant="ghost" size="icon" onClick={() => onRemove(index)} type="button">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Fila 2: Descripcion + Descuento */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-6">
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

        <div className="col-span-3">
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

        <div className="col-span-3">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {item.discountType === "PERCENTAGE" ? "Descuento (%)" : "Descuento ($)"}
          </label>
          <Input
            type="number"
            min={0}
            value={item.discountValue ?? 0}
            disabled={!item.discountType}
            onChange={(e) => onChange(index, "discountValue", Number(e.target.value))}
            placeholder="0"
          />
        </div>
      </div>

      {/* Fila 3: Fechas de alquiler (solo para RENTAL) */}
      {item.itemType === "RENTAL" && (
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha Recogida</label>
            <Input
              type="date"
              value={item.rentalPickupDate}
              onChange={(e) => onChange(index, "rentalPickupDate", e.target.value)}
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha Devolución</label>
            <Input
              type="date"
              value={item.rentalReturnDate}
              onChange={(e) => onChange(index, "rentalReturnDate", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
