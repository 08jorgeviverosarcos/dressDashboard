# Entity Selector Modal v2 — Implementation Plan

## Overview

Implement three extensions to the Entity Selector system:
1. **ProductQuickForm** — Quick-create form for products (inside EntitySelectorModal)
2. **OrderItemSelectorModal** — Master-detail modal to replace cascading dropdowns in ExpenseForm
3. **Inventory "Add Item" Page** — Dedicated `/inventario/nuevo` page replacing the inline dialog
4. **Cleanup** — Remove old dialog code from InventoryTable

## Current State Analysis

### EntitySelectorModal (v1)
- Generic `<T>` modal: search + DataTable + optional quick-create
- File: `src/components/shared/EntitySelectorModal.tsx`
- Flat single-level list — no drill-down support
- Quick-create via `allowCreate` + `renderCreateForm` props

### Existing QuickForms
- `CategoryQuickForm`: 2 fields (name, code) — `src/features/products/components/CategoryQuickForm.tsx`
- `ClientQuickForm`: 3 fields (name, phone, email) — `src/features/clients/components/ClientQuickForm.tsx`
- Pattern: `useState` fields + server action + `onCreated(item)` callback + `DialogFooter`

### ExpenseForm Order→OrderItem Cascade
- File: `src/components/expenses/ExpenseForm.tsx:224-265`
- Two `<Select>` dropdowns: Order (local state) → OrderItem (RHF field `orderItemId`)
- `selectedOrderId` is `useState`, reverse-looked-up from `initialData.orderItemId` in edit mode
- `filteredItems` derived from `orders.find(o => o.id === selectedOrderId)?.items`
- Orders loaded in `src/app/gastos/nuevo/page.tsx` via `getOrders()` with items mapped to `{ id, product: { name, code } }`

### Inventory Add Dialog
- File: `src/app/inventario/inventory-table.tsx:58-67, 90-112, 202-250`
- Dialog with `useState` fields: productId, productName, quantity, notes
- Already uses `EntitySelectorTrigger` + `EntitySelectorModal` for product selection (v1)
- No `allowCreate` — only select existing products
- Server action: `createInventoryItem({ productId, quantityOnHand, notes })`

### Key Discoveries:
- Orders data includes `client.name`, `orderNumber`, `status`, `items[].product.{name,code}` — sufficient for the order selector modal
- The expense page maps order data at `src/app/gastos/nuevo/page.tsx:12-19` — this mapping will need to be extended to include `client.name` and `status`
- Product auto-code suggestion (`src/app/productos/product-form.tsx:75-95`) calls `getSuggestedProductCode(categoryId)` — the QuickForm will include this
- `createProduct` action returns `ActionResult<{ id: string }>` at `src/lib/actions/products.ts:32-41`

## Desired End State

1. **ExpenseForm**: Single `EntitySelectorTrigger` button that opens an `OrderItemSelectorModal`. The modal shows a searchable list of orders. Clicking an order drills into its items. Clicking an item selects it and closes the modal. The trigger displays `"Pedido #N — {item code} — {item name}"`. Clear button resets to no order item.

2. **Inventory page**: "Agregar Item" button navigates to `/inventario/nuevo`. That page has a form with product selector (with `allowCreate` using `ProductQuickForm`), quantity, and notes. On submit, navigates back to `/inventario`.

3. **ProductQuickForm**: Renders inside EntitySelectorModal's create view. Fields: code (with auto-suggestion), name, type, categoryId (with nested category selector + CategoryQuickForm). On create, calls `createProduct` and returns `{ id, code, name }`.

### How to verify:
- ExpenseForm: Create a new expense, click the order item selector, search for an order, drill into it, select an item. Edit an existing expense with an order item — it should pre-display the selected item.
- Inventory: Click "Agregar Item" → navigates to `/inventario/nuevo`. Select a product (or create one inline). Submit → navigates back with item created.
- ProductQuickForm: From the inventory new-item page, open product selector, click "Crear nuevo", fill in the form, click "Crear y Seleccionar" → product is created and selected.

## What We're NOT Doing

- NOT extending `EntitySelectorModal` with generic master-detail — creating a specific `OrderItemSelectorModal` instead
- NOT adding all product fields to ProductQuickForm — only code, name, type, categoryId
- NOT adding new fields to the inventory add form (keeping product + quantity + notes)
- NOT changing any server actions, services, or repos
- NOT modifying the product-form.tsx auto-code suggestion (reusing the existing `getSuggestedProductCode` action)

## Implementation Approach

Build bottom-up: ProductQuickForm first (dependency for Phase 3), then OrderItemSelectorModal (independent), then inventory page (uses ProductQuickForm).

---

## Phase 1: ProductQuickForm

### Overview
Create a `ProductQuickForm` component following the `CategoryQuickForm`/`ClientQuickForm` pattern, with 4 fields (code, name, type, categoryId) and auto-code suggestion.

### Changes Required:

#### 1. New file: `src/features/products/components/ProductQuickForm.tsx`

**File**: `src/features/products/components/ProductQuickForm.tsx` (new)
**Pattern**: Same as `CategoryQuickForm.tsx` — `useState` fields, server action, `onCreated` callback

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
import { CategoryQuickForm } from "@/features/products/components/CategoryQuickForm";
import { createProduct, getSuggestedProductCode } from "@/lib/actions/products";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants/categories";

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
}

interface ProductQuickFormProps {
  onCreated: (product: ProductOption) => void;
  onCancel: () => void;
  categories: CategoryOption[];
}

export function ProductQuickForm({ onCreated, onCancel, categories }: ProductQuickFormProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("RENTAL");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);

  // Auto-code suggestion (same logic as ProductForm)
  const hasManualCodeEdit = useRef(false);
  const isApplyingSuggestion = useRef(false);
  const suggestionRequestId = useRef(0);

  useEffect(() => {
    if (!categoryId) return;
    if (hasManualCodeEdit.current && code) return;

    const currentRequestId = ++suggestionRequestId.current;
    void (async () => {
      const result = await getSuggestedProductCode(categoryId);
      if (!result.success) return;
      if (currentRequestId !== suggestionRequestId.current) return;

      isApplyingSuggestion.current = true;
      setCode(result.data.code);
      isApplyingSuggestion.current = false;
    })();
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryColumns: EntitySelectorColumn<CategoryOption>[] = [
    { key: "name", header: "Nombre", cell: (c) => c.name },
    { key: "code", header: "Código", cell: (c) => c.code, className: "w-[100px]" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!code.trim() || !name.trim() || !type) return;
    setLoading(true);
    const result = await createProduct({
      code: code.trim(),
      name: name.trim(),
      type: type as "RENTAL" | "SALE" | "BOTH",
      categoryId: categoryId || null,
      salePrice: null,
      rentalPrice: null,
      cost: null,
      description: "",
    });
    setLoading(false);
    if (result.success) {
      toast.success("Producto creado");
      onCreated({ id: result.data.id, code: code.trim(), name: name.trim() });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pq-code">Código *</Label>
          <Input
            id="pq-code"
            value={code}
            onChange={(e) => {
              if (!isApplyingSuggestion.current) {
                hasManualCodeEdit.current = true;
              }
              setCode(e.target.value);
            }}
            placeholder="VG-001"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pq-name">Nombre *</Label>
          <Input
            id="pq-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del producto"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="text-base md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoría</Label>
          <EntitySelectorTrigger
            placeholder="Sin categoría"
            displayValue={categories.find((c) => c.id === categoryId)?.name}
            onClick={() => setCategorySelectorOpen(true)}
            onClear={() => setCategoryId(null)}
          />
          <EntitySelectorModal
            open={categorySelectorOpen}
            onOpenChange={setCategorySelectorOpen}
            title="Seleccionar Categoría"
            searchPlaceholder="Buscar categoría..."
            items={categories}
            columns={categoryColumns}
            searchFilter={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
            getItemId={(c) => c.id}
            selectedId={categoryId ?? undefined}
            onSelect={(c) => setCategoryId(c.id)}
            allowCreate
            createLabel="Crear categoría"
            renderCreateForm={({ onCreated: onCatCreated, onCancel: onCatCancel }) => (
              <CategoryQuickForm onCreated={(cat) => { setCategoryId(cat.id); onCatCreated(cat); }} onCancel={onCatCancel} />
            )}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Volver
        </Button>
        <Button type="submit" disabled={loading || !code.trim() || !name.trim()}>
          {loading ? "Creando..." : "Crear y Seleccionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

**Key decisions:**
- `categories` prop is required — the parent must pass available categories (same SSR pattern)
- Auto-code suggestion reuses `getSuggestedProductCode` action from `src/lib/actions/products.ts`
- Uses `useState` (not RHF) matching the QuickForm pattern
- Category selector inside the QuickForm opens its own `EntitySelectorModal` with `allowCreate` (nested modals — Radix handles this via portals)
- When category is created via `CategoryQuickForm`, the `onCreated` callback first updates the local `categoryId` state, then forwards to the modal's `onCatCreated` to close the nested modal

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] No lint errors: `npx next lint`

#### Manual Verification:
- [ ] Component renders correctly inside an EntitySelectorModal create view (will be tested in Phase 3 when wired into inventory)
- [ ] Auto-code suggestion works when selecting a category
- [ ] Manual code edit overrides auto-suggestion
- [ ] Category selector opens nested modal correctly
- [ ] "Crear y Seleccionar" creates product and returns to parent

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: OrderItemSelectorModal

### Overview
Create a dedicated `OrderItemSelectorModal` component for the ExpenseForm that replaces the two cascading `<Select>` dropdowns with a master-detail drill-down modal.

### Changes Required:

#### 1. Extend the OrderOption interface in ExpenseForm

**File**: `src/components/expenses/ExpenseForm.tsx`
**Changes**: Add `client` and `status` fields to `OrderOption` interface

The `OrderOption` interface needs to include client name and status for display in the order list:

```typescript
interface OrderOption {
  id: string;
  orderNumber: number;
  status: string;
  clientName: string;
  items: OrderItemOption[];
}
```

#### 2. Update expense page data mapping

**File**: `src/app/gastos/nuevo/page.tsx`
**Changes**: Include `client.name` and `status` in the order mapping

```typescript
orders={orders.map((o) => ({
  id: o.id,
  orderNumber: o.orderNumber,
  status: o.status,
  clientName: o.client?.name ?? "",
  items: o.items.map((i) => ({
    id: i.id,
    product: { name: (i.name || i.product?.name) ?? "", code: i.product?.code ?? "" },
  })),
}))}
```

**File**: `src/app/gastos/[id]/editar/page.tsx`
**Changes**: Same mapping update (edit page also renders ExpenseForm with orders)

#### 3. New file: `src/features/expenses/components/OrderItemSelectorModal.tsx`

**File**: `src/features/expenses/components/OrderItemSelectorModal.tsx` (new)

This is a **specific component** (not generic) that handles the master-detail pattern:
- **Level 1 (orders list)**: Searchable list of orders showing `#orderNumber`, `clientName`, `status`, `items count`
- **Level 2 (order detail)**: Shows selected order info + its items as a selectable list
- Back button returns to Level 1
- Selecting an item calls `onSelect` with the item and closes the modal

```tsx
"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
      setSearch("");
      setSelectedOrder(null);
    }
  }, [open]);

  // --- Level 1: Orders list ---
  const filteredOrders = search === ""
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
    { key: "items", header: "Items", cell: (o) => o.items.length, className: "text-center" },
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
```

#### 4. Update ExpenseForm to use OrderItemSelectorModal

**File**: `src/components/expenses/ExpenseForm.tsx`
**Changes**: Replace the two `<Select>` dropdowns (lines 224-265) with `EntitySelectorTrigger` + `OrderItemSelectorModal`

Remove:
- `selectedOrderId` state (line 58-63)
- `filteredItems` derivation (line 65)
- The two `<Select>` in the grid at lines 224-265

Add:
- `orderItemSelectorOpen` state
- `displayOrderItem` — derived display value from `orders` + `form.watch("orderItemId")`
- `EntitySelectorTrigger` + `OrderItemSelectorModal`

The new section replacing lines 224-265:

```tsx
// State for modal
const [orderItemSelectorOpen, setOrderItemSelectorOpen] = useState(false);

// Derive display value from current orderItemId
const currentOrderItemId = form.watch("orderItemId");
const displayOrderItem = (() => {
  if (!currentOrderItemId) return undefined;
  for (const order of orders) {
    const item = order.items.find((i) => i.id === currentOrderItemId);
    if (item) return `Pedido #${order.orderNumber} — ${item.product.code} — ${item.product.name}`;
  }
  return undefined;
})();
```

In the JSX, replace the two-Select grid with:

```tsx
<FormField control={form.control} name="orderItemId" render={({ field }) => (
  <FormItem className="sm:col-span-2">
    <FormLabel>Item de Pedido Asociado (opcional)</FormLabel>
    <FormControl>
      <EntitySelectorTrigger
        placeholder="Sin pedido asociado"
        displayValue={displayOrderItem}
        onClick={() => setOrderItemSelectorOpen(true)}
        onClear={() => field.onChange("")}
      />
    </FormControl>
    <OrderItemSelectorModal
      open={orderItemSelectorOpen}
      onOpenChange={setOrderItemSelectorOpen}
      orders={orders}
      selectedItemId={field.value || undefined}
      onSelect={(item) => field.onChange(item.id)}
      onClear={() => field.onChange("")}
    />
    <FormMessage />
  </FormItem>
)} />
```

**Note**: The field now spans the full width (`sm:col-span-2`) since it replaces two separate fields. The grid wrapper `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">` at line 224 can remain but contain only this one field with `sm:col-span-2`, or be removed and the field placed outside a grid.

#### 5. Remove unused imports

**File**: `src/components/expenses/ExpenseForm.tsx`
**Changes**: Remove `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` imports if no other Select usage remains in the form (check: category and subcategory selects still use them, so keep the imports).

Actually — the category, subcategory, expenseType, and paymentMethod fields all use `<Select>`, so the Select imports stay. Only remove `selectedOrderId` state and `filteredItems` derivation.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] No lint errors: `npx next lint`

#### Manual Verification:
- [ ] Open "Nuevo Gasto" → the "Item de Pedido Asociado" shows as an EntitySelectorTrigger
- [ ] Click trigger → OrderItemSelectorModal opens showing list of orders with #, client, status, items count
- [ ] Search by order number works
- [ ] Search by client name works
- [ ] Click an order → drills into items list with back button
- [ ] Click an item → selects it, modal closes, trigger shows `"Pedido #N — code — name"`
- [ ] Click X on trigger → clears selection
- [ ] "Quitar selección" button in modal clears and closes
- [ ] Edit an existing expense with orderItemId → trigger shows the correct display value
- [ ] Edit an existing expense → change the order item to a different one → saves correctly
- [ ] Create expense without order item → works as before (field is optional)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Inventory "Add Item" Page

### Overview
Replace the inline Dialog in `InventoryTable` with a dedicated `/inventario/nuevo` page. The page uses `ProductQuickForm` from Phase 1 inside the product selector.

### Changes Required:

#### 1. New file: `src/app/inventario/nuevo/page.tsx` (Server Component)

**File**: `src/app/inventario/nuevo/page.tsx` (new)

```tsx
import { getProducts } from "@/lib/actions/products";
import { getCategories } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryItemForm } from "./inventory-item-form";

export default async function NuevoInventarioPage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Agregar Item" backHref="/inventario" />
      <InventoryItemForm
        products={products.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
      />
    </div>
  );
}
```

**Note**: Categories are loaded here and passed down because `ProductQuickForm` needs them for the inline category selector.

#### 2. New file: `src/app/inventario/nuevo/inventory-item-form.tsx` (Client Component)

**File**: `src/app/inventario/nuevo/inventory-item-form.tsx` (new)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
import { ProductQuickForm } from "@/features/products/components/ProductQuickForm";
import { createInventoryItem } from "@/lib/actions/inventory";
import { Loader2 } from "lucide-react";

interface ProductOption {
  id: string;
  code: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

interface InventoryItemFormProps {
  products: ProductOption[];
  categories: CategoryOption[];
}

export function InventoryItemForm({ products, categories }: InventoryItemFormProps) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  // Track locally-created products so they appear in the selector
  const [localProducts, setLocalProducts] = useState<ProductOption[]>([]);
  const allProducts = [...products, ...localProducts];

  const productColumns: EntitySelectorColumn<ProductOption>[] = [
    { key: "code", header: "Código", cell: (p) => p.code, className: "w-[100px]" },
    { key: "name", header: "Nombre", cell: (p) => p.name },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      toast.error("Seleccione un producto");
      return;
    }
    setLoading(true);
    const result = await createInventoryItem({
      productId,
      quantityOnHand: quantity,
      notes: notes || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Item agregado al inventario");
      router.push("/inventario");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Producto *</Label>
            <EntitySelectorTrigger
              placeholder="Seleccionar producto..."
              displayValue={productName || undefined}
              onClick={() => setProductSelectorOpen(true)}
              onClear={() => { setProductId(""); setProductName(""); }}
            />
            <EntitySelectorModal
              open={productSelectorOpen}
              onOpenChange={setProductSelectorOpen}
              title="Seleccionar Producto"
              searchPlaceholder="Buscar por código o nombre..."
              size="lg"
              items={allProducts}
              columns={productColumns}
              searchFilter={(p, q) => {
                const lower = q.toLowerCase();
                return p.code.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower);
              }}
              getItemId={(p) => p.id}
              selectedId={productId}
              onSelect={(p) => { setProductId(p.id); setProductName(`${p.code} - ${p.name}`); }}
              allowCreate
              createLabel="Crear producto"
              renderCreateForm={({ onCreated, onCancel }) => (
                <ProductQuickForm
                  onCreated={(p) => {
                    setLocalProducts((prev) => [...prev, p]);
                    onCreated(p);
                  }}
                  onCancel={onCancel}
                  categories={categories}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales..."
              className="text-base md:text-sm"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => router.push("/inventario")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !productId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Key decisions:**
- `localProducts` state tracks products created via `ProductQuickForm` so they appear immediately in the selector list (since the page data was loaded at SSR time and won't include newly created products)
- Same fields as current dialog: product, quantity, notes
- Same server action call: `createInventoryItem({ productId, quantityOnHand, notes })`
- Uses `Card` wrapper matching other form pages (e.g., ExpenseForm, ProductForm)
- Responsive patterns: `sm:grid-cols-2` for fields, `flex flex-col sm:flex-row` for buttons

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] No lint errors: `npx next lint`

#### Manual Verification:
- [ ] Navigate to `/inventario/nuevo` → page loads with form
- [ ] Product selector opens modal with search
- [ ] Click "Crear producto" → ProductQuickForm renders
- [ ] Fill ProductQuickForm → select category → code auto-suggests
- [ ] Submit ProductQuickForm → product created, selected, modal closes
- [ ] The newly created product appears if you open the selector again
- [ ] Set quantity and notes → submit → item created → navigates to `/inventario`
- [ ] Error case: submit without product → toast error "Seleccione un producto"
- [ ] Cancel button → navigates back to `/inventario`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Cleanup — Remove Old Inventory Dialog

### Overview
Remove the inline "Add Item" Dialog from `InventoryTable` and change the "Agregar Item" button to navigate to `/inventario/nuevo`.

### Changes Required:

#### 1. Update InventoryTable

**File**: `src/app/inventario/inventory-table.tsx`
**Changes**:

**Remove** (state variables, lines 58-67):
- `addOpen` state
- `newProductId`, `newProductName`, `newQuantity`, `newNotes` states
- `productSelectorOpen` state

**Remove** (function, lines 90-112):
- `handleAdd` function

**Remove** (JSX, lines 202-250):
- Entire `{/* Add Dialog */}` block (Dialog + DialogContent + EntitySelectorTrigger + EntitySelectorModal)

**Remove** (columns definition, lines 165-168):
- `productColumns` definition (no longer needed)

**Remove** unused imports:
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` (check if ConfirmDialog still needs them — it doesn't, ConfirmDialog is a separate component)
- `Input` (if not used elsewhere in the file — check: not used elsewhere)
- `Label` (if not used elsewhere — check: not used elsewhere)
- `Textarea` (if not used elsewhere — check: not used elsewhere)
- `EntitySelectorTrigger` (no longer used here)
- `EntitySelectorModal, type EntitySelectorColumn` (no longer used here)

**Update** the "Agregar Item" button (line 176-179):

Change from:
```tsx
<Button onClick={() => setAddOpen(true)}>
  <Plus className="mr-2 h-4 w-4" />
  Agregar Item
</Button>
```

To:
```tsx
<Link href="/inventario/nuevo">
  <Button>
    <Plus className="mr-2 h-4 w-4" />
    Agregar Item
  </Button>
</Link>
```

Add import: `import Link from "next/link";`

**Update** the `products` prop: Since the InventoryTable no longer needs products for the add dialog, **remove** the `products` prop from `InventoryTableProps` and from the component's parameter.

#### 2. Update inventory page.tsx

**File**: `src/app/inventario/page.tsx`
**Changes**:
- Remove `getProducts()` import and call (line 19)
- Remove `products` prop from `<InventoryTable>` (line 27)
- Simplify the `Promise.all` to just `getInventoryItems(...)`

```tsx
export default async function InventarioPage({ searchParams }: Props) {
  const params = await searchParams;

  const items = await getInventoryItems({
    search: params.search,
    status: params.status as InventoryStatus | undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventario" description="Gestiona el inventario de productos" />
      <InventoryTable
        items={JSON.parse(JSON.stringify(items))}
        currentStatus={params.status}
      />
    </div>
  );
}
```

Remove unused import: `import { getProducts } from "@/lib/actions/products";`

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] No lint errors: `npx next lint`
- [x] No unused imports/variables

#### Manual Verification:
- [ ] Inventory list page loads correctly
- [ ] "Agregar Item" button navigates to `/inventario/nuevo` (not opening a dialog)
- [ ] No dialog appears anywhere on the inventory list page
- [ ] Status filter still works
- [ ] Search still works
- [ ] Row click navigates to detail page
- [ ] Delete button still works
- [ ] Full flow: Agregar → fill form → submit → back on list with new item

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Manual Testing Steps:

**ExpenseForm (Phase 2):**
1. Create expense → open order item selector → search → drill into order → select item → create expense → verify orderItemId saved
2. Create expense without order item → verify works as before
3. Edit expense with existing orderItemId → verify trigger shows correct display → change to different item → save
4. Edit expense → clear order item → save → verify orderItemId is null/empty

**Inventory (Phase 3-4):**
1. Navigate to `/inventario/nuevo` → select existing product → set quantity to 3 → add notes → submit → verify item appears in list
2. Navigate to `/inventario/nuevo` → create new product via ProductQuickForm → verify it's selected → submit
3. ProductQuickForm: select category → verify code auto-suggests → clear category → select different one → verify code updates
4. ProductQuickForm: manually type code → select category → verify auto-suggest does NOT override manual code

## Performance Considerations

- No new server-side queries — all data is already loaded via existing SSR patterns
- `OrderItemSelectorModal` filters client-side over pre-loaded orders array (same pattern as EntitySelectorModal)
- `localProducts` array in inventory form prevents need for page refresh after creating a product
- Category list for `ProductQuickForm` is loaded once at page level and passed down

## References

- Research document: `thoughts/shared/research/2026-02-25_14-15-00_general_entity-selector-modal-v2-research.md`
- v1 plan: `thoughts/shared/plans/2026-02-25_12-27-59_general_entity-selector-modal.md`
- EntitySelectorModal: `src/components/shared/EntitySelectorModal.tsx`
- EntitySelectorTrigger: `src/components/shared/EntitySelectorTrigger.tsx`
- CategoryQuickForm pattern: `src/features/products/components/CategoryQuickForm.tsx`
- ClientQuickForm pattern: `src/features/clients/components/ClientQuickForm.tsx`
- ExpenseForm: `src/components/expenses/ExpenseForm.tsx`
- InventoryTable: `src/app/inventario/inventory-table.tsx`
- ProductForm (auto-code reference): `src/app/productos/product-form.tsx`
