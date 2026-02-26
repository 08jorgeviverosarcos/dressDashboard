"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LocalSearchInput } from "@/components/shared/LocalSearchInput";
import { ORDER_STATUS_LABELS } from "@/lib/constants/categories";

interface OrderItemOption {
  id: string;
  product: { name: string; code: string };
}

interface OrderOption {
  id: string;
  orderNumber: number;
  status: string;
  clientName: string;
  items: OrderItemOption[];
}

interface OrderItemSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderOption[];
  selectedItemId?: string;
  onSelect: (item: OrderItemOption, order: OrderOption) => void;
  onClear: () => void;
}

export function OrderItemSelectorModal({
  open,
  onOpenChange,
  orders,
  selectedItemId,
  onSelect,
  onClear,
}: OrderItemSelectorModalProps) {
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);

  // Reset state on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch("");
      setSelectedOrder(null);
    }
  }, [open]);

  // --- Level 1: Orders list ---
  const filteredOrders =
    search === ""
      ? orders
      : orders.filter((o) => {
          const lower = search.toLowerCase();
          return (
            o.orderNumber.toString().includes(lower) ||
            o.clientName.toLowerCase().includes(lower)
          );
        });

  const orderColumns: Column<OrderOption>[] = [
    { key: "order", header: "Pedido", cell: (o) => `#${o.orderNumber}` },
    { key: "client", header: "Cliente", cell: (o) => o.clientName },
    {
      key: "status",
      header: "Estado",
      cell: (o) => (
        <Badge variant="outline">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
      ),
    },
    {
      key: "items",
      header: "Items",
      cell: (o) => o.items.length,
      className: "text-center",
    },
  ];

  // --- Level 2: Order items ---
  const itemColumns: Column<OrderItemOption>[] = [
    { key: "code", header: "Código", cell: (i) => i.product.code },
    { key: "name", header: "Producto", cell: (i) => i.product.name },
  ];

  const handleSelectOrder = (order: OrderOption) => {
    setSelectedOrder(order);
    setSearch("");
  };

  const handleSelectItem = (item: OrderItemOption) => {
    onSelect(item, selectedOrder!);
    onOpenChange(false);
  };

  const handleClear = () => {
    onClear();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {selectedOrder && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="h-7 w-7 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {selectedOrder
                ? `Pedido #${selectedOrder.orderNumber} — ${selectedOrder.clientName}`
                : "Seleccionar Item de Pedido"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {!selectedOrder ? (
          <>
            <LocalSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por # pedido o cliente..."
            />
            <ScrollArea className="max-h-[50vh]">
              <div className="overflow-x-auto">
                <DataTable
                  columns={orderColumns}
                  data={filteredOrders}
                  onRowClick={handleSelectOrder}
                  emptyMessage="No se encontraron pedidos"
                />
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Selecciona un item de este pedido:
            </p>
            <ScrollArea className="max-h-[50vh]">
              <div className="overflow-x-auto">
                <DataTable
                  columns={itemColumns}
                  data={selectedOrder.items}
                  onRowClick={handleSelectItem}
                  emptyMessage="Este pedido no tiene items"
                />
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {selectedItemId && (
            <Button variant="ghost" type="button" onClick={handleClear}>
              Quitar selección
            </Button>
          )}
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
