# Responsive Design Fixes — Implementation Plan

## Overview

Fix all responsive design issues identified in the audit so the dashboard is fully usable on mobile devices. This is a CSS-only refactor — no logic changes, no new components, no new dependencies.

## Current State Analysis

The layout shell (sidebar/hamburger) and dashboard page are responsive. Most standard forms use correct `sm:grid-cols-N` patterns. However:

- `OrderItemRow.tsx` uses `grid-cols-12` fixed — completely unusable on mobile (~26px per column)
- `order-item-edit-form.tsx` uses `grid-cols-2/3` without mobile base
- `PaymentDialog.tsx` has grids without breakpoints and doesn't use `DialogFooter`
- 8 form button rows use `flex justify-end` without mobile stacking
- 4 inline tables lack `overflow-x-auto`
- 4 DataTables with 8+ columns don't hide non-essential columns on mobile

### Key Discoveries:
- `DataTable` applies `col.className` to both `TableHead` and `TableCell` — adding `hidden md:table-cell` to a column's className hides it on mobile automatically
- `DialogFooter` already has `flex-col-reverse gap-2 sm:flex-row sm:justify-end` — just need to use it
- All fixes are className-only changes — no logic, no behavior changes

## Desired End State

Every page and component in the dashboard works on a 375px-wide mobile screen:
- All grids have `grid-cols-1` as mobile base
- All form button rows stack vertically on mobile
- All inline tables have horizontal scroll
- Tables with 8+ columns hide non-essential columns on mobile
- `OrderItemRow` fields stack vertically on mobile

### Verification:
- Open every page at 375px viewport width in Chrome DevTools
- All content fits, no horizontal page overflow
- All inputs are usable (not crammed)
- All buttons are tappable

## What We're NOT Doing

- NOT converting tables to card layouts
- NOT adding JS media query hooks
- NOT adding new packages
- NOT changing any business logic
- NOT adding new components
- NOT modifying the sidebar/layout (already done)

## Implementation Approach

5 phases, ordered by impact and dependency. Each phase is independent — can be tested separately.

---

## Phase 1: OrderItemRow Responsive (CRITICAL)

### Overview
Make the inline order item editor usable on mobile by stacking fields vertically.

### Changes Required:

#### 1. OrderItemRow.tsx
**File**: `src/components/orders/OrderItemRow.tsx`

**Row 1 (line ~109)** — Main fields (Tipo, Producto, Cant, Precio, Costo, Subtotal):
```
Current: "grid grid-cols-12 gap-2 items-end"
New:     "grid grid-cols-1 gap-2 items-end sm:grid-cols-2 md:grid-cols-12"
```

Child col-spans need responsive overrides:
- `col-span-2` (Tipo) → `sm:col-span-1 md:col-span-2`
- `col-span-4` (Producto) → `sm:col-span-1 md:col-span-4`
- `col-span-1` (Cantidad) → `sm:col-span-1 md:col-span-1`
- `col-span-2` (Precio) → `sm:col-span-1 md:col-span-2`
- `col-span-2` (Costo) → `sm:col-span-1 md:col-span-2`
- `col-span-1` (Subtotal) → `sm:col-span-1 md:col-span-1`

**Row 2 (line ~183)** — Description + Discount:
```
Current: "grid grid-cols-12 gap-2 items-end"
New:     "grid grid-cols-1 gap-2 items-end sm:grid-cols-2 md:grid-cols-12"
```

- `col-span-6` (Descripcion) → `sm:col-span-2 md:col-span-6`
- `col-span-3` (Tipo descuento) → `sm:col-span-1 md:col-span-3`
- `col-span-3` (Descuento) → `sm:col-span-1 md:col-span-3`

**Row 3 (line ~249, RENTAL only)** — Fecha Devolución + Depósito:
```
Current: "grid grid-cols-12 gap-2 items-end"
New:     "grid grid-cols-1 gap-2 items-end sm:grid-cols-2 md:grid-cols-12"
```

- `col-span-3` (Fecha) → `sm:col-span-1 md:col-span-3`
- `col-span-3` (Deposito) → `sm:col-span-1 md:col-span-3`

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit` (pre-existing errors only, none new)
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] At 375px: all 6 fields in row 1 stack to 1 column, each input full width
- [ ] At 640px+: fields arrange in 2 columns
- [ ] At 768px+: original 12-column layout preserved exactly
- [ ] All field values, calculations, and interactions work identically

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 2: OrderItemEditForm + PaymentDialog Grids

### Overview
Add responsive breakpoints to grids in the standalone item edit form and payment dialog.

### Changes Required:

#### 1. order-item-edit-form.tsx
**File**: `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx`

4 grid fixes:
- Line ~149: `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 gap-4 sm:grid-cols-2"`
- Line ~208: `"grid grid-cols-3 gap-4"` → `"grid grid-cols-1 gap-4 sm:grid-cols-3"`
- Line ~229: `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 gap-4 sm:grid-cols-2"`
- Line ~277: `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 gap-4 sm:grid-cols-2"`

Also remove `max-w-xs` from child divs at line ~278, ~286 (conflicts with full-width mobile).

Button row fix:
- Line ~304: `"flex gap-2"` → `"flex flex-col gap-3 sm:flex-row"`

#### 2. PaymentDialog.tsx
**File**: `src/components/orders/PaymentDialog.tsx`

2 grid fixes:
- Line ~96: `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 gap-4 sm:grid-cols-2"`
- Line ~122: `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 gap-4 sm:grid-cols-2"`

Button row fix — replace bare div with `DialogFooter`:
- Line ~171: Replace `<div className="flex justify-end gap-2">` with `<DialogFooter>`
- Close tag: `</div>` → `</DialogFooter>`
- Add `DialogFooter` to imports from `@/components/ui/dialog`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] order-item-edit-form at 375px: all grids stack to 1 column
- [ ] PaymentDialog at 375px: fields stack, buttons stack via DialogFooter
- [ ] At 640px+: 2/3 column layouts restore
- [ ] All form submissions work identically

**Implementation Note**: Pause for manual confirmation.

---

## Phase 3: Button Rows (All Forms)

### Overview
Make all form button rows stack vertically on mobile.

### Changes Required:

8 files, same pattern for each — change `flex justify-end gap-3` to `flex flex-col gap-3 sm:flex-row sm:justify-end`:

| File | Line | Current | New |
|------|------|---------|-----|
| `src/components/orders/OrderForm.tsx` | ~303 | `flex justify-end gap-3` | `flex flex-col gap-3 sm:flex-row sm:justify-end` |
| `src/components/expenses/ExpenseForm.tsx` | ~267 | `flex justify-end gap-3 pt-4` | `flex flex-col gap-3 sm:flex-row sm:justify-end pt-4` |
| `src/app/productos/product-form.tsx` | ~232 | `flex justify-end gap-3 pt-4` | `flex flex-col gap-3 sm:flex-row sm:justify-end pt-4` |
| `src/app/categorias/nuevo/page.tsx` | ~80 | `flex justify-end gap-3 pt-4` | `flex flex-col gap-3 sm:flex-row sm:justify-end pt-4` |
| `src/app/clientes/nuevo/page.tsx` | ~132 | `flex justify-end gap-3 pt-4` | `flex flex-col gap-3 sm:flex-row sm:justify-end pt-4` |
| `src/app/clientes/[id]/editar/page.tsx` | ~132 | `flex justify-end gap-3 pt-4` | `flex flex-col gap-3 sm:flex-row sm:justify-end pt-4` |
| `src/app/categorias/[id]/editar/page.tsx` | ~117 | `flex justify-between pt-4` | `flex flex-col gap-3 sm:flex-row sm:justify-between pt-4` |

Also fix OrderForm totals row:
- `src/components/orders/OrderForm.tsx` line ~290: add `flex-wrap` to existing classes

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] At 375px: all button rows stack vertically (full-width buttons)
- [ ] At 640px+: buttons restore to horizontal layout
- [ ] Category edit page: Delete button stacks above Cancel/Save group on mobile

**Implementation Note**: Pause for manual confirmation.

---

## Phase 4: Inline Tables — overflow-x-auto

### Overview
Add horizontal scroll wrapper to all 4 inline tables that use raw `<table>` elements.

### Changes Required:

| File | Line | Current | New |
|------|------|---------|-----|
| `src/app/pedidos/[id]/page.tsx` | ~179 | `"rounded-md border"` | `"overflow-x-auto rounded-md border"` |
| `src/app/clientes/[id]/page.tsx` | ~74 | `"rounded-md border"` | `"overflow-x-auto rounded-md border"` |
| `src/app/productos/[id]/page.tsx` | ~104 | `"rounded-md border"` | `"overflow-x-auto rounded-md border"` |
| `src/app/categorias/[id]/page.tsx` | ~60 | `"rounded-md border"` | `"overflow-x-auto rounded-md border"` |

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] At 375px: all 4 inline tables scroll horizontally without breaking page layout
- [ ] Table content is fully accessible via horizontal scroll

**Implementation Note**: Pause for manual confirmation.

---

## Phase 5: DataTable Column Hiding (8+ columns)

### Overview
Hide non-essential columns on mobile for the 4 largest DataTables using `hidden md:table-cell`.

### Changes Required:

#### 1. gastos-table.tsx (10 cols → 5 on mobile)
**File**: `src/app/gastos/gastos-table.tsx`

Hide these columns (add `hidden md:table-cell` to className):
- `subcategory` (line ~60) — Subcategoria
- `description` (line ~61) — Descripcion
- `responsible` (line ~62) — Encargado
- `method` (line ~74-78) — Metodo
- `order` (line ~79-90) — Pedido/Item

Mobile shows: Fecha, Categoria, Valor, Tipo, Actions

#### 2. order-items-table.tsx (9 cols → 4 on mobile)
**File**: `src/app/pedidos/[id]/order-items-table.tsx`

Hide these columns:
- `cantidad` (line ~82-87) — Cant.
- `precioUnit` (line ~88-93) — Precio Unit.
- `descuento` (line ~94-104) — Descuento
- `costo` (line ~105-110) — Costo
- `deposito` (line ~111-119) — Deposito

Mobile shows: Tipo, Nombre, Subtotal, Actions

#### 3. payments-table.tsx (8 cols → 5 on mobile)
**File**: `src/app/pagos/payments-table.tsx`

Hide these columns:
- `type` (line ~93-99) — Tipo
- `method` (line ~100-106) — Metodo
- `ref` (line ~107) — Referencia

Mobile shows: Fecha, Pedido, Cliente, Monto, Actions

#### 4. orders-table.tsx (8 cols → 5 on mobile)
**File**: `src/app/pedidos/orders-table.tsx`

Hide these columns:
- `date` (line ~70) — Fecha
- `event` (line ~71) — Evento
- `paid` (line ~73-87) — % Pagado

Mobile shows: #, Cliente, Total, Estado, Actions

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] App builds: `npm run build`

#### Manual Verification:
- [ ] At 375px: each table shows only essential columns
- [ ] At 768px+: all columns visible again
- [ ] No data loss — hidden columns are still accessible on desktop

**Implementation Note**: Pause for manual confirmation.

---

## Testing Strategy

### Per-Phase:
- TypeScript compilation check
- Next.js build
- Visual check at 375px, 640px, 768px, 1024px viewports

### Final Integration:
1. Navigate every page at 375px — no horizontal page overflow
2. Create an order with items on mobile — all fields usable
3. Create a payment via dialog on mobile — fields stack, buttons stack
4. Browse all list tables on mobile — essential columns visible, horizontal scroll for hidden content not needed
5. Edit a client, product, category on mobile — buttons stack properly

## Performance Considerations

None. All changes are CSS class modifications — zero runtime impact.

## References

- Audit: `thoughts/shared/research/2026-02-24_17-36-58_general_responsive-design-audit.md`
- Conventions: `CLAUDE.md` §17 (Responsive Design)
