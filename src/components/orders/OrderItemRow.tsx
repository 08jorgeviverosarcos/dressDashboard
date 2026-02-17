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
  salePrice: number | null;
  cost: number | null;
}

interface OrderItemRowProps {
  index: number;
  item: {
    productId: string;
    quantity: number;
    unitPrice: number;
    costAmount: number;
  };
  products: ProductOption[];
  onChange: (index: number, field: string, value: unknown) => void;
  onRemove: (index: number) => void;
}

export function OrderItemRow({ index, item, products, onChange, onRemove }: OrderItemRowProps) {
  function handleProductChange(productId: string) {
    const product = products.find((p) => p.id === productId);
    onChange(index, "productId", productId);
    if (product) {
      onChange(index, "unitPrice", product.salePrice ?? 0);
      onChange(index, "costAmount", product.cost ?? 0);
    }
  }

  const subtotal = item.quantity * item.unitPrice;

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-4">
        {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto</label>}
        <Select value={item.productId} onValueChange={handleProductChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code} - {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">Cantidad</label>}
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
      <div className="col-span-1">
        {index === 0 && <label className="text-xs font-medium text-muted-foreground mb-1 block">&nbsp;</label>}
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} type="button">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
