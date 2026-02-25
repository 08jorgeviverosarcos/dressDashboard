---
date: 2026-02-25T12:27:59-06:00
author: Claude
branch: main
topic: "Entity Selector Modal — Implementation Plan"
tags: [plan, entity-selector, modal, ui-pattern, forms, components]
status: draft
---

# Entity Selector Modal — Implementation Plan

## Overview

Build a reusable `EntitySelectorModal<T>` component and two supporting primitives (`LocalSearchInput`, `EntitySelectorTrigger`) that together replace all shadcn `Select` dropdowns used for entity FK selections with a modal-based table + search + optional inline-create flow. Migrate 6 of 7 selector instances (skipping ExpenseForm cascading selectors for v1).

---

## Current State Analysis

The app has **7 selector instances** using shadcn `Select` for entity FK relationships. All data is SSR-loaded as props — no client-side fetching exists.

**State management split:**
- `useState` (manual): `OrderForm` (Client), `OrderItemRow` (via parent dispatch), `OrderItemEditForm` (Product), `InventoryTable` (Product)
- RHF `FormField`: `ProductForm` (Category), `ExpenseForm` (OrderItem — skipped)

**Key building blocks already available:**
- `DataTable<T>` (`src/components/shared/DataTable.tsx`) — has `onRowClick`, `Column<T>` interface. Its outer wrapper is `<div className="rounded-md border">` (no `overflow-x-auto`) — modal must add its own wrapper.
- `ConfirmDialog` (`src/components/shared/ConfirmDialog.tsx`) — reference pattern for headless dialogs with `open`/`onOpenChange`/`DialogFooter`.
- `Dialog` primitives (`src/components/ui/dialog.tsx`) — `DialogContent` is responsive by default (`max-w-[calc(100%-2rem)] sm:max-w-lg`). `DialogFooter` auto-stacks buttons on mobile (`flex-col-reverse sm:flex-row`).
- `ScrollArea` (`src/components/ui/scroll-area.tsx`) — for height-limiting the table inside the modal.
- `SearchInput` — URL-params based (`router.replace`), **NOT reusable** inside modals → new `LocalSearchInput` required.

**Key technical findings:**
- `DataTable` row keys use array index `i`, not record ID. Acceptable for v1.
- `ProductForm` uses `null`/`""` coercion on `categoryId`: `value={field.value ?? ""}` and `field.onChange(v || null)`. Must preserve this in migration.
- `OrderItemRow` is stateless — auto-fill dispatches via `onChange(index, field, value)` to parent `OrderForm`.
- `InventoryTable` Product selector lives inside an existing Dialog — nesting two Dialogs is technically supported by Radix UI portals.

---

## Desired End State

After this plan is complete:

1. Three new shared components: `LocalSearchInput`, `EntitySelectorTrigger`, `EntitySelectorModal<T>`.
2. Six selector instances migrated: OrderForm (Client), OrderItemRow (Product), OrderItemEditForm (Product), ProductForm (Category), InventoryTable (Product).
3. Two quick-create forms: `CategoryQuickForm` and `ClientQuickForm`.
4. ProductForm Category and OrderForm Client selectors have `allowCreate` with their respective quick forms.
5. All migrated selectors submit the same FK values as before — no behavioral regression.
6. All components are fully responsive per CLAUDE.md §17.

### Verification:
- [ ] All 6 selector locations open a modal on click
- [ ] Search filters the list client-side in real time
- [ ] Single-click on row selects the entity and closes the modal
- [ ] Selected entity name/code appears in the trigger button
- [ ] Clear button removes the selection where applicable
- [ ] No regression in form submission (same FK values stored)
- [ ] Auto-fill still works in OrderItemRow and OrderItemEditForm
- [ ] CategoryQuickForm creates a Category and auto-selects it
- [ ] ClientQuickForm creates a Client and auto-selects it
- [ ] All components fully responsive (stack on mobile, no iOS zoom)

---

## What We're NOT Doing

- ❌ NOT migrating `ExpenseForm` cascading selectors (Order → OrderItem) — deferred to v2
- ❌ NOT adding client-side data fetching (all data remains SSR props)
- ❌ NOT using CommandDialog/cmdk — table + search is the specified pattern
- ❌ NOT modifying `DataTable.tsx` — using as-is with `onRowClick`
- ❌ NOT modifying `SearchInput.tsx` — creating separate `LocalSearchInput`
- ❌ NOT introducing persistent row highlighting (single-click-closes means no state between click and close)
- ❌ NOT opening nested modals for Create flow — view switches inside the same modal

---

## Implementation Approach

Build bottom-up in 7 phases:
1. **Foundation** — `LocalSearchInput` + `EntitySelectorTrigger`
2. **Core modal** — `EntitySelectorModal<T>`
3. **OrderForm** — Client selector migration (no `allowCreate` yet)
4. **OrderItemRow + OrderItemEditForm** — Product selectors (auto-fill + type filtering)
5. **CategoryQuickForm + ProductForm** — Category migration with `allowCreate`
6. **ClientQuickForm + OrderForm** — Retroactive `allowCreate` for Client
7. **InventoryTable** — Product selector (nested dialog case)

---

## Phase 1: Foundation Components

### Overview
Create `LocalSearchInput` (controlled search with local state) and `EntitySelectorTrigger` (button that looks like a SelectTrigger). Both are leaf components with no dependencies on the modal.

### Changes Required:

#### 1. `LocalSearchInput`
**File**: `src/components/shared/LocalSearchInput.tsx`

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface LocalSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function LocalSearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
}: LocalSearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 text-base md:text-sm"
      />
    </div>
  );
}
```

#### 2. `EntitySelectorTrigger`
**File**: `src/components/shared/EntitySelectorTrigger.tsx`

```tsx
"use client";

import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntitySelectorTriggerProps {
  placeholder?: string;
  displayValue?: string;
  onClick: () => void;
  onClear?: () => void;
  disabled?: boolean;
}

export function EntitySelectorTrigger({
  placeholder = "Seleccionar...",
  displayValue,
  onClick,
  onClear,
  disabled,
}: EntitySelectorTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <span className={cn("truncate", displayValue ? "text-foreground" : "text-muted-foreground")}>
        {displayValue ?? placeholder}
      </span>
      <div className="flex shrink-0 items-center gap-1 ml-2">
        {onClear && displayValue && (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          />
        )}
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>
    </button>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] Both files exist at their declared paths

#### Manual Verification:
- [ ] `LocalSearchInput` renders with Search icon, accepts typing, is a controlled input
- [ ] `EntitySelectorTrigger` renders with ChevronsUpDown icon, shows placeholder when no `displayValue`
- [ ] Trigger shows `displayValue` + X button when `displayValue` is set
- [ ] X button click calls `onClear` without triggering `onClick`
- [ ] Input preserves `text-base md:text-sm` (no iOS zoom)

**Implementation Note**: After completing this phase, pause for manual visual verification before proceeding.

---

## Phase 2: EntitySelectorModal\<T\>

### Overview
The core generic modal. Uses `LocalSearchInput`, `DataTable`, `ScrollArea`, and Dialog primitives. Supports two views: `"list"` (default) and `"create"` (when `allowCreate=true`). Resets state on every open.

### Changes Required:

#### 1. `EntitySelectorModal`
**File**: `src/components/shared/EntitySelectorModal.tsx`

```tsx
"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LocalSearchInput } from "@/components/shared/LocalSearchInput";

export interface EntitySelectorColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface EntitySelectorModalProps<T> {
  // Control
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Entity config
  title: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  size?: "default" | "lg"; // "default" = sm:max-w-lg, "lg" = sm:max-w-2xl

  // Data
  items: T[];
  columns: EntitySelectorColumn<T>[];
  searchFilter: (item: T, query: string) => boolean;
  getItemId: (item: T) => string;

  // Selection
  selectedId?: string;
  onSelect: (item: T) => void;

  // Create (optional)
  allowCreate?: boolean;
  createLabel?: string;
  renderCreateForm?: (props: {
    onCreated: (item: T) => void;
    onCancel: () => void;
  }) => ReactNode;
}

export function EntitySelectorModal<T>({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  emptyMessage,
  size = "default",
  items,
  columns,
  searchFilter,
  getItemId,
  selectedId,
  onSelect,
  allowCreate,
  createLabel = "Crear nuevo",
  renderCreateForm,
}: EntitySelectorModalProps<T>) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create">("list");

  // Reset state every time the modal opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setView("list");
    }
  }, [open]);

  const filteredItems =
    search === "" ? items : items.filter((item) => searchFilter(item, search));

  const tableColumns: Column<T>[] = columns.map((col) => ({
    key: col.key,
    header: col.header,
    cell: col.cell,
    className: col.className,
  }));

  const handleSelect = (item: T) => {
    onSelect(item);
    onOpenChange(false);
  };

  const handleCreated = (item: T) => {
    onSelect(item);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={size === "lg" ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {view === "create" && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setView("list")}
                className="h-7 w-7 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {view === "create" ? createLabel : title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {view === "list" && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <LocalSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={searchPlaceholder ?? "Buscar..."}
                />
              </div>
              {allowCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setView("create")}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {createLabel}
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-[50vh]">
              <div className="overflow-x-auto">
                <DataTable
                  columns={tableColumns}
                  data={filteredItems}
                  onRowClick={handleSelect}
                  emptyMessage={emptyMessage ?? "No se encontraron resultados"}
                />
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </>
        )}

        {view === "create" &&
          renderCreateForm?.({
            onCreated: handleCreated,
            onCancel: () => setView("list"),
          })}
      </DialogContent>
    </Dialog>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] File exists at `src/components/shared/EntitySelectorModal.tsx`

#### Manual Verification:
- [ ] Modal opens and closes correctly via `onOpenChange`
- [ ] Search input filters the list in real time
- [ ] Clicking a row calls `onSelect` and closes the modal
- [ ] "Crear nuevo" button appears only when `allowCreate=true`
- [ ] Clicking "Crear nuevo" switches to create view with back arrow
- [ ] Back arrow returns to list view (search preserved)
- [ ] Modal resets search + view to `"list"` when reopened
- [ ] Table scrolls horizontally on small screens (overflow-x-auto)
- [ ] DialogFooter "Cancelar" button stacks correctly on mobile

**Implementation Note**: After completing this phase, pause for manual smoke test using a test usage in any form before proceeding to migrations.

---

## Phase 3: Migrate OrderForm — Client Selector

### Overview
Replace the Client `<Select>` in `OrderForm.tsx` (lines 217-226) with `EntitySelectorTrigger` + `EntitySelectorModal`. No `allowCreate` yet — added in Phase 6.

### Changes Required:

**File**: `src/components/orders/OrderForm.tsx`

**Imports to add:**
```tsx
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
```

**Imports to remove:** Remove `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from the shadcn Select import **only if** Select is no longer used elsewhere in the file. Verify first.

**State to add** (after the existing `clientId` useState):
```tsx
const [clientName, setClientName] = useState(
  initialData ? (clients.find((c) => c.id === initialData.clientId)?.name ?? "") : ""
);
const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
```

**Columns definition** (before return statement):
```tsx
const clientColumns: EntitySelectorColumn<ClientOption>[] = [
  { key: "name", header: "Nombre", cell: (c) => c.name },
];
```

**Replace lines 217-226** (the `<Select>...</Select>` block):

Before:
```tsx
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
```

After:
```tsx
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
/>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Trigger shows "Seleccionar cliente..." when empty
- [ ] Clicking trigger opens modal with full client list
- [ ] Searching filters clients by name
- [ ] Clicking a client row closes modal and shows client name in trigger
- [ ] X button clears the selection (`clientId` and `clientName` reset to `""`)
- [ ] Form submission works with correct `clientId`
- [ ] Edit mode seeds `clientName` correctly from `initialData`

**Implementation Note**: After completing this phase, pause for manual smoke test before proceeding.

---

## Phase 4: Migrate OrderItemRow + OrderItemEditForm — Product Selectors

### Overview
Replace Product `<Select>` in both `OrderItemRow` and `OrderItemEditForm`. Both have identical auto-fill logic and type-based filtering. The auto-fill behavior must be preserved exactly (see `handleProductChange` in both files).

**Important**: No `onClear` on product selectors — the current UI has no "clear product" action, so we preserve that behavior.

### Changes Required:

#### 1. OrderItemRow
**File**: `src/components/orders/OrderItemRow.tsx`

**Imports to add:**
```tsx
import { useState } from "react";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
```

**State to add** (component is currently stateless — this is the only new state):
```tsx
const [productSelectorOpen, setProductSelectorOpen] = useState(false);
```

**Before the return statement, add:**
```tsx
const selectedProduct = products.find((p) => p.id === item.productId);

const productColumns: EntitySelectorColumn<ProductOption>[] = [
  { key: "code", header: "Código", cell: (p) => p.code, className: "w-[100px]" },
  { key: "name", header: "Nombre", cell: (p) => p.name },
  { key: "type", header: "Tipo", cell: (p) => p.type, className: "hidden sm:table-cell" },
];
```

**Replace lines 135-147** (the `<Select>...</Select>` block inside the `item.itemType !== "SERVICE"` branch):

Before:
```tsx
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
```

After:
```tsx
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
```

#### 2. OrderItemEditForm
**File**: `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx`

**Imports to add:**
```tsx
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
```

**State to add:**
```tsx
const [productSelectorOpen, setProductSelectorOpen] = useState(false);
```

**Before the return statement, add:**
```tsx
const selectedProduct = products.find((p) => p.id === productId);

const productColumns: EntitySelectorColumn<ProductOption>[] = [
  { key: "code", header: "Código", cell: (p) => p.code, className: "w-[100px]" },
  { key: "name", header: "Nombre", cell: (p) => p.name },
  { key: "type", header: "Tipo", cell: (p) => p.type, className: "hidden sm:table-cell" },
];
```

**Replace lines 175-186** (the `<Select>...</Select>` block inside the `itemType !== "SERVICE"` branch):

Same pattern as OrderItemRow. The `handleProductChange` in this file uses individual `setState` calls instead of `onChange(index, field, value)` dispatch — the auto-fill logic itself is identical and must not change.

```tsx
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
  selectedId={productId}
  onSelect={(p) => handleProductChange(p.id)}
/>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`

#### Manual Verification:
- [ ] OrderItemRow: product modal shows only products matching `itemType` filter (`filteredProducts`)
- [ ] OrderItemRow: selecting a product auto-fills `name`, `description`, `unitPrice`, `costAmount`
- [ ] RENTAL: `unitPrice = rentalPrice ?? salePrice ?? 0`, `costAmount = 0`
- [ ] SALE: `unitPrice = salePrice ?? 0`, `costAmount = cost ?? 0`
- [ ] OrderItemEditForm: identical auto-fill behavior
- [ ] Display value shows `code - name` format after selection
- [ ] No regression in form submission

**Implementation Note**: After completing this phase, pause for manual smoke test before proceeding.

---

## Phase 5: CategoryQuickForm + ProductForm Category Migration

### Overview
First create `CategoryQuickForm`, then migrate the Category selector in `ProductForm` with `allowCreate`. The RHF `FormField` wrapper must be preserved — only the inner `Select` is replaced.

**Before implementing**: Read `src/lib/actions/categories.ts` (or wherever `createCategory` lives) to confirm the action signature and `ActionResult<T>` return type. Read the Category Zod schema to know required vs optional fields.

### Changes Required:

#### 1. CategoryQuickForm
**File**: `src/features/products/components/CategoryQuickForm.tsx`

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { createCategory } from "@/lib/actions/categories"; // verify exact path before implementing

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

interface CategoryQuickFormProps {
  onCreated: (category: CategoryOption) => void;
  onCancel: () => void;
}

export function CategoryQuickForm({ onCreated, onCancel }: CategoryQuickFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const result = await createCategory({ name: name.trim(), code: code.trim() });
    setLoading(false);
    if (result.success) {
      toast.success("Categoría creada");
      onCreated(result.data);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cat-name">Nombre *</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-code">Código</Label>
          <Input
            id="cat-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: VES"
            className="text-base md:text-sm"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Volver
        </Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creando..." : "Crear y Seleccionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

**Note**: Adjust the `createCategory` import path and payload shape after reading the actual action file.

#### 2. ProductForm — Category selector migration
**File**: `src/app/productos/product-form.tsx`

**Imports to add:**
```tsx
import { useState } from "react";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
import { CategoryQuickForm } from "@/features/products/components/CategoryQuickForm";
```

**State to add:**
```tsx
const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);
```

**Columns definition** (before return):
```tsx
const categoryColumns: EntitySelectorColumn<Category>[] = [
  { key: "name", header: "Nombre", cell: (c) => c.name },
  { key: "code", header: "Código", cell: (c) => c.code, className: "w-[100px]" },
];
```

**Replace lines 177-203** (the `<FormField name="categoryId">` content — keep the FormField wrapper, only replace the `<Select>` inside):

Before (the Select inside FormField):
```tsx
<Select
  value={field.value ?? ""}
  onValueChange={(v) => field.onChange(v || null)}
>
  <FormControl>
    <SelectTrigger>
      <SelectValue placeholder="Sin categoría" />
    </SelectTrigger>
  </FormControl>
  <SelectContent>
    {categories.map((cat) => (
      <SelectItem key={cat.id} value={cat.id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

After (inside the same FormField `render` function):
```tsx
<FormControl>
  <EntitySelectorTrigger
    placeholder="Sin categoría"
    displayValue={categories.find((c) => c.id === field.value)?.name}
    onClick={() => setCategorySelectorOpen(true)}
    onClear={() => field.onChange(null)}
  />
</FormControl>
<EntitySelectorModal
  open={categorySelectorOpen}
  onOpenChange={setCategorySelectorOpen}
  title="Seleccionar Categoría"
  searchPlaceholder="Buscar categoría..."
  items={categories}
  columns={categoryColumns}
  searchFilter={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
  getItemId={(c) => c.id}
  selectedId={field.value ?? undefined}
  onSelect={(c) => field.onChange(c.id)}
  allowCreate
  createLabel="Crear categoría"
  renderCreateForm={({ onCreated, onCancel }) => (
    <CategoryQuickForm onCreated={onCreated} onCancel={onCancel} />
  )}
/>
```

**Important note on `onClear`**: `field.onChange(null)` preserves the existing `null` coercion. The `useWatch` on `categoryId` will fire and trigger the code suggestion effect as before.

**Important note on new categories**: After `onCreated(cat)`, the new category is auto-selected but will NOT appear in the `categories` list until page refresh (data is SSR-loaded). The selection is correct in the form state. Acceptable for v1.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] `createCategory` action path/signature verified before implementing
- [x] `CategoryQuickForm` file exists at declared path

#### Manual Verification:
- [ ] Category selector modal opens with list of categories
- [ ] Searching filters categories by name
- [ ] "Crear categoría" button opens create view
- [ ] Creating a category auto-selects it and closes modal
- [ ] Category name appears in trigger after selection
- [ ] X button clears the selection (`field.onChange(null)`, not empty string)
- [ ] `useWatch` on `categoryId` still triggers code auto-suggestion after selection
- [ ] No regression in product creation/update

**Implementation Note**: Read `createCategory` action before writing the file. Pause after this phase for manual smoke test.

---

## Phase 6: ClientQuickForm + OrderForm Client allowCreate

### Overview
Create `ClientQuickForm` and add `allowCreate` to the OrderForm Client selector (already migrated in Phase 3).

**Before implementing**: Read `src/lib/actions/clients.ts` to confirm `createClient` action signature and return type. Read `src/lib/validations/client.ts` for required vs optional fields.

### Changes Required:

#### 1. ClientQuickForm
**File**: `src/features/clients/components/ClientQuickForm.tsx`

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/actions/clients"; // verify exact path before implementing

interface ClientOption {
  id: string;
  name: string;
}

interface ClientQuickFormProps {
  onCreated: (client: ClientOption) => void;
  onCancel: () => void;
}

export function ClientQuickForm({ onCreated, onCancel }: ClientQuickFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const result = await createClient({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Cliente creado");
      onCreated(result.data);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cl-name">Nombre *</Label>
          <Input
            id="cl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del cliente"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cl-phone">Teléfono</Label>
          <Input
            id="cl-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="555-0000"
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cl-email">Email</Label>
          <Input
            id="cl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            className="text-base md:text-sm"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Volver
        </Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creando..." : "Crear y Seleccionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

**Note**: Adjust `createClient` import path, payload shape, and field list after reading the actual action file.

#### 2. Add allowCreate to OrderForm Client selector
**File**: `src/components/orders/OrderForm.tsx`

**Import to add:**
```tsx
import { ClientQuickForm } from "@/features/clients/components/ClientQuickForm";
```

**Update the `EntitySelectorModal` added in Phase 3** — add the allowCreate props:
```tsx
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
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] `createClient` action path/signature verified before implementing
- [x] `ClientQuickForm` file exists at declared path

#### Manual Verification:
- [ ] "Crear cliente" button appears in Client selector modal
- [ ] ClientQuickForm renders with Name, Teléfono, Email fields
- [ ] Creating a client auto-selects it and closes modal
- [ ] Client name appears in trigger after creation
- [ ] No regression in order creation/update

**Implementation Note**: Read `createClient` action before writing the file. Pause after this phase for manual smoke test.

---

## Phase 7: InventoryTable — Product Selector Migration

### Overview
Replace the Product `<Select>` inside the "Agregar Item al Inventario" Dialog in `InventoryTable`. This creates a nested Dialog (EntitySelectorModal inside the existing Add Dialog). Radix UI renders each Dialog into a separate portal, so layering is handled correctly — but test explicitly.

### Changes Required:

**File**: `src/app/inventario/inventory-table.tsx`

**Imports to add:**
```tsx
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
```

**State to add:**
```tsx
const [productSelectorOpen, setProductSelectorOpen] = useState(false);
const [newProductName, setNewProductName] = useState("");
```

**Columns definition** (before return):
```tsx
const productColumns: EntitySelectorColumn<ProductOption>[] = [
  { key: "code", header: "Código", cell: (p) => p.code, className: "w-[100px]" },
  { key: "name", header: "Nombre", cell: (p) => p.name },
];
```

**Replace lines 201-212** (the `<Select>...</Select>` block):

Before:
```tsx
<Select value={newProductId} onValueChange={setNewProductId}>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar producto..." />
  </SelectTrigger>
  <SelectContent>
    {products.map((p) => (
      <SelectItem key={p.id} value={p.id}>
        {p.code} - {p.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

After:
```tsx
<EntitySelectorTrigger
  placeholder="Seleccionar producto..."
  displayValue={newProductName || undefined}
  onClick={() => setProductSelectorOpen(true)}
  onClear={() => { setNewProductId(""); setNewProductName(""); }}
/>
<EntitySelectorModal
  open={productSelectorOpen}
  onOpenChange={setProductSelectorOpen}
  title="Seleccionar Producto"
  searchPlaceholder="Buscar por código o nombre..."
  size="lg"
  items={products}
  columns={productColumns}
  searchFilter={(p, q) => {
    const lower = q.toLowerCase();
    return p.code.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower);
  }}
  getItemId={(p) => p.id}
  selectedId={newProductId}
  onSelect={(p) => { setNewProductId(p.id); setNewProductName(`${p.code} - ${p.name}`); }}
/>
```

**Also reset `newProductName`** wherever `newProductId` and other add-form state is reset (after submit and on dialog close).

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Nested dialogs open and close correctly (outer Add dialog + inner Product selector)
- [ ] Selecting a product closes the Product selector but keeps the Add dialog open
- [ ] Product display value shows `code - name` in the trigger
- [ ] X button clears product selection
- [ ] Form submission works with correct `newProductId`
- [ ] Closing the Add dialog resets `newProductName`

**Implementation Note**: Test nested dialog behavior explicitly. Pause after this phase for final manual smoke test.

---

## Testing Strategy

### Full Regression Test (after all phases):
1. `/pedidos/nuevo` — verify Client selector, add SALE and RENTAL items with Product selector, auto-fill check
2. `/pedidos/[id]` — edit an existing order item, verify Product selector and auto-fill
3. `/productos/nuevo` — verify Category selector, test "Crear categoría" inline flow
4. `/productos/[id]/editar` — same Category selector, verify `useWatch` code suggestion fires
5. `/pedidos/nuevo` — test "Crear cliente" flow: creates client, auto-selects, submits order
6. `/inventario` — open "Agregar Item" dialog, verify nested Product selector

### Edge Cases:
- Empty search → shows all items
- Search with no matches → shows `emptyMessage`
- Modal closed mid-search → reopening shows empty search
- Rapid open/close → no state leakage between sessions
- Clear button → form value returns to `""` or `null` (not `undefined`) depending on context
- Edit mode → existing selection is seeded correctly on mount

---

## Performance Considerations

All data is SSR-loaded. Client-side filtering is synchronous and fast at current data volumes (estimated < 500 records per entity). No performance concerns in v1. Future enhancement: add server-action-based search for high-volume entities.

---

## References

- Original specification: `thoughts/shared/research/2026-02-24_22-00-00_general_entity-selector-modal-pattern-spec.md`
- Responsive design rules: `CLAUDE.md §17`
- Dialog reference pattern: `src/components/shared/ConfirmDialog.tsx`
- DataTable interface: `src/components/shared/DataTable.tsx`
- Dialog primitives: `src/components/ui/dialog.tsx`
- SearchInput (NOT reusable in modals): `src/components/shared/SearchInput.tsx`
