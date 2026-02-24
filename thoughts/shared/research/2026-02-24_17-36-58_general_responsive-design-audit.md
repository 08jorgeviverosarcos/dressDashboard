---
date: 2026-02-24T17:36:58Z
researcher: Claude Opus 4.6
git_commit: 566bb455d56d017b7972df6c5327b68d5e779017
branch: main
repository: dressDashboard
topic: "Responsive Design Audit — Full Site Mobile Readiness"
tags: [research, codebase, responsive, mobile, tailwind, layout, tables, forms, sidebar]
status: complete
last_updated: 2026-02-24
last_updated_by: Claude Opus 4.6
---

# Research: Responsive Design Audit — Full Site Mobile Readiness

**Date**: 2026-02-24T17:36:58Z
**Researcher**: Claude Opus 4.6
**Git Commit**: `566bb455d56d017b7972df6c5327b68d5e779017`
**Branch**: main
**Repository**: dressDashboard

---

## Research Question

El sitio necesita ser full responsive para ser usado desde dispositivos móviles. Auditar todo el estado actual de responsive design e identificar qué falta para que sea completamente responsive.

---

## Summary

La aplicación tiene un **esqueleto de layout responsive** (sidebar con hamburger menu) pero la mayoría del contenido interior — especialmente tablas de datos, el formulario de items de pedido (`OrderItemRow`), y los headers de página — no se adaptan a pantallas pequeñas. Los formularios regulares usan correctamente `grid-cols-1 sm:grid-cols-N` y funcionan bien en mobile. Las tablas dependen exclusivamente de scroll horizontal sin ocultar columnas ni apilar filas. El componente más crítico para mobile es `OrderItemRow.tsx`, que usa `grid-cols-12` fijo sin ningún breakpoint responsive.

**Tecnología de responsive**: Tailwind CSS v4 con breakpoints por defecto (`sm` = 640px, `md` = 768px). Solo se usan `sm:` y `md:` en todo el codebase. No hay `@media` queries manuales, no hay hooks de media query, y no hay componentes utilitarios responsive.

---

## Detailed Findings

### CAPA 1 — Layout Principal (RESPONSIVE ✅)

**Archivos:** `src/app/layout.tsx`, `src/components/layout/Sidebar.tsx`

La capa de layout está correctamente implementada con un patrón hamburger menu completo:

| Viewport | Sidebar | Contenido principal | Hamburger |
|----------|---------|---------------------|-----------|
| < 768px  | Drawer slide-in (`-translate-x-full` → `translate-x-0`) | Full width, `pt-16` para clearar botón | Visible (`fixed left-4 top-4 z-50`) |
| ≥ 768px  | Fixed sidebar 256px (`md:flex md:w-64`) | `md:ml-64`, `md:pt-6` | Oculto (`md:hidden`) |

- El sidebar tiene overlay semitransparente en mobile (`bg-black/50`)
- Los links del nav cierran el sidebar al hacer click (`onClick={() => setMobileOpen(false)}`)
- **No hay header dedicado** — el botón hamburger ES el único elemento de encabezado en mobile

---

### CAPA 2 — Dashboard / Home (RESPONSIVE ✅)

**Archivo:** `src/app/page.tsx`, `src/app/dashboard-charts.tsx`

| Línea | Clase | Comportamiento |
|-------|-------|----------------|
| `page.tsx:30` | `grid gap-4 md:grid-cols-5` | 5 KPI cards → 1 columna en mobile |
| `page.tsx:88` | `grid gap-6 md:grid-cols-2` | Top Products + Eventos → 1 col mobile |
| `page.tsx:149` | `grid gap-6 md:grid-cols-2` | Pagos + Inventario → 1 col mobile |
| `dashboard-charts.tsx:34` | `grid gap-6 md:grid-cols-2` | Gráficas → 1 col mobile |
| `dashboard-charts.tsx:40,58` | `h-[300px] w-full` | Altura fija, ancho fluido — OK |

Los charts usan `RechartsPrimitive.ResponsiveContainer` internamente — se adaptan al ancho del padre.

---

### CAPA 3 — Formularios (MAYORMENTE RESPONSIVE ✅ / ⚠️ parcial)

La mayoría de formularios usan correctamente `grid grid-cols-1 gap-4 sm:grid-cols-N`:

| Formulario | Archivo | Responsive |
|------------|---------|------------|
| Cliente crear/editar | `clientes/nuevo/page.tsx:80`, `clientes/[id]/editar/page.tsx:91` | ✅ `sm:grid-cols-2` |
| Producto crear/editar | `productos/product-form.tsx:83,112,164` | ✅ `sm:grid-cols-2`, `sm:grid-cols-3` |
| Categoría crear/editar | `categorias/nuevo/page.tsx:51`, `categorias/[id]/editar/page.tsx:88` | ✅ `sm:grid-cols-2` |
| Gasto crear/editar | `components/expenses/ExpenseForm.tsx:118,143,184,224` | ✅ `sm:grid-cols-2`, `sm:grid-cols-3` |
| Pedido crear/editar | `components/orders/OrderForm.tsx:202,233,243` | ✅ `sm:grid-cols-3`, `sm:grid-cols-2` |

**Problemas en formularios:**

- **Botones de formulario** — TODOS usan `flex justify-end gap-3` sin `flex-col` en mobile. Los botones no se apilan en pantallas pequeñas. Solo `DialogFooter` del base `dialog.tsx` apila correctamente con `flex-col-reverse gap-2 sm:flex-row sm:justify-end`.
- **`OrderForm.tsx:290`** — `flex justify-end gap-8` sin wrapping en la fila de resumen de totales — puede desbordarse en pantallas muy estrechas.

---

### CAPA 4 — OrderItemRow ⛔ CRÍTICO (NO RESPONSIVE)

**Archivo:** `src/components/orders/OrderItemRow.tsx`

Este es el **componente más problemático para mobile**. Usa `grid-cols-12` fijo en tres filas sin ningún breakpoint:

| Línea | Grid | Columnas | Problema |
|-------|------|----------|---------|
| `109` | `grid grid-cols-12 gap-2` | Tipo(2), Producto(4), Cant(1), Precio(2), Costo(2), Subtotal(1) | 6 inputs en 1 fila sin adapt. |
| `183` | `grid grid-cols-12 gap-2` | Descripción(6), TipoDescuento(3), ValorDescuento(3) | 3 inputs fijos |
| `249` | `grid grid-cols-12 gap-2` | FechaDevolucion(3), Deposito(3) | 2 inputs fijos (rental) |

En un teléfono de 375px, el área usable del main es ~310px. Cada `col-span-1` sería ~26px — los inputs son **completamente inutilizables**.

---

### CAPA 5 — OrderItemEditForm ⚠️ MEDIO (NO RESPONSIVE)

**Archivo:** `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx`

| Línea | Clase | Problema |
|-------|-------|----------|
| `149` | `grid grid-cols-2 gap-4` | Sin breakpoint — 2 cols siempre |
| `208` | `grid grid-cols-3 gap-4` | Sin breakpoint — 3 cols siempre |
| `229` | `grid grid-cols-2 gap-4` | Sin breakpoint — 2 cols siempre |
| `277` | `grid grid-cols-2 gap-4` | Sin breakpoint — 2 cols siempre |

---

### CAPA 6 — Tablas de Datos ⚠️ SCROLL SOLO (SIN ADAPTACIÓN REAL)

**Archivo base:** `src/components/shared/DataTable.tsx`, `src/components/ui/table.tsx`

El componente `Table` en `src/components/ui/table.tsx:11` tiene `overflow-x-auto` — las tablas pueden scrollear horizontalmente. Sin embargo, no hay adaptación real para mobile (no se ocultan columnas, no se apilan filas como cards).

| Tabla | Archivo | Columnas | Riesgo Mobile |
|-------|---------|----------|---------------|
| GastosTable | `gastos/gastos-table.tsx` | **10 columnas** | 🔴 CRÍTICO scroll |
| OrderItemsTable | `pedidos/[id]/order-items-table.tsx` | **9 columnas** | 🔴 CRÍTICO scroll |
| PaymentsTable | `pagos/payments-table.tsx` | **8 columnas** | 🔴 MUY ALTO |
| OrdersTable | `pedidos/orders-table.tsx` | **8 columnas** | 🔴 MUY ALTO |
| InventoryTable | `inventario/inventory-table.tsx` | **7 columnas** | 🟡 ALTO |
| ProductsTable | `productos/products-table.tsx` | **6 columnas** | 🟡 ALTO |
| ClientsTable | `clientes/clients-table.tsx` | **5 columnas** | 🟡 MEDIO |
| CategoriesTable | `categorias/categories-table.tsx` | **3 columnas** | 🟢 BAJO |

**Tablas inline sin `overflow-x-auto` explícito** (usan `<table>` crudo):
- `pedidos/[id]/page.tsx:179` — Gastos vinculados (5 col) — ⚠️ el `overflow-x-auto` del `Table` shadcn NO aplica aquí
- `clientes/[id]/page.tsx:74` — Historial de pedidos (5 col)
- `productos/[id]/page.tsx:104` — Pedidos recientes (5 col)
- `categorias/[id]/page.tsx:60` — Productos de categoría (3 col)

---

### CAPA 7 — Páginas de Detalle (MAYORMENTE RESPONSIVE ✅)

| Página | Grids Responsive | Tablas Inline |
|--------|------------------|---------------|
| `pedidos/[id]` | ✅ `md:grid-cols-4`, `md:grid-cols-2` | ⚠️ Sin `overflow-x-auto` |
| `productos/[id]` | ✅ `md:grid-cols-2` | ⚠️ Sin `overflow-x-auto` |
| `clientes/[id]` | Single col (OK) | ⚠️ Sin `overflow-x-auto` |
| `categorias/[id]` | Single col (OK) | ⚠️ Sin `overflow-x-auto` |
| `inventario/[id]` | Single col (OK) | N/A |
| `pagos/[id]` | Single col (OK) | N/A |
| `gastos/[id]` | Single col (OK) | N/A |

---

### CAPA 8 — Dialogs / Modales (MAYORMENTE RESPONSIVE ✅ / ⚠️ parcial)

El `dialog.tsx` base de shadcn tiene responsive correcto:
- `DialogContent:64` — `max-w-[calc(100%-2rem)] sm:max-w-lg` — mobile-safe width
- `DialogHeader:88` — `text-center sm:text-left`
- `DialogFooter:106` — `flex-col-reverse gap-2 sm:flex-row sm:justify-end` — botones apilados en mobile

**PaymentDialog** (`components/orders/PaymentDialog.tsx`) — ⚠️ NO usa `DialogFooter`:
- `line 96`: `grid grid-cols-2 gap-4` — sin breakpoint
- `line 122`: `grid grid-cols-2 gap-4` — sin breakpoint
- `line 171`: `flex justify-end gap-2` — botones no se apilan

---

### CAPA 9 — Componentes Compartidos

| Componente | Archivo | Responsive |
|------------|---------|------------|
| `PageHeader` | `shared/PageHeader.tsx:21` | ⚠️ `flex justify-between` — no wrapping si título largo + botón largo |
| `SearchInput` | `shared/SearchInput.tsx` | ✅ `w-full` — fluido |
| `StatusBadge` | `shared/StatusBadge.tsx` | ✅ inline badge |
| `CurrencyDisplay` | `shared/CurrencyDisplay.tsx` | ✅ inline text |
| `ConfirmDialog` | `shared/ConfirmDialog.tsx` | ✅ hereda Dialog responsive |
| `MoneyInput` | `shared/MoneyInput.tsx` | ✅ full width |
| `DataTable` | `shared/DataTable.tsx` | ⚠️ solo scroll horizontal |

---

### CAPA 10 — Configuración Tailwind & Viewport

- **Tailwind CSS v4** — configuración CSS-first en `globals.css`, sin `tailwind.config.ts`
- **Breakpoints en uso**: solo `sm:` (640px) y `md:` (768px). `lg:`, `xl:`, `2xl:` no se usan en `src/`
- **Viewport meta**: Next.js inyecta automáticamente `width=device-width, initial-scale=1`
- **Input/Textarea**: `md:text-sm` en ambos — previene zoom iOS (base es `text-base` = 16px)
- **Sin hooks de media query**, sin `useMediaQuery`, sin componentes `MobileOnly`/`DesktopOnly`

---

## Code References

### Críticos (sin responsive)
- `src/components/orders/OrderItemRow.tsx:109,183,249` — `grid-cols-12` fijo
- `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx:149,208,229,277` — `grid-cols-2/3` sin breakpoints

### Tablas inline sin overflow
- `src/app/pedidos/[id]/page.tsx:179` — tabla de gastos vinculados
- `src/app/clientes/[id]/page.tsx:74` — historial de pedidos
- `src/app/productos/[id]/page.tsx:104` — pedidos recientes del producto
- `src/app/categorias/[id]/page.tsx:60` — productos de categoría

### Botones sin apilado mobile
- `src/components/orders/PaymentDialog.tsx:171` — `flex justify-end gap-2`
- `src/components/orders/OrderForm.tsx:303` — `flex justify-end gap-3`
- `src/app/clientes/nuevo/page.tsx:132` — `flex justify-end gap-3`
- `src/app/productos/product-form.tsx:232` — `flex justify-end gap-3`

### Layout correcto (referencia)
- `src/components/layout/Sidebar.tsx:72-102` — sidebar mobile/desktop completo
- `src/app/layout.tsx:33-34` — main content margin y padding responsive
- `src/components/ui/dialog.tsx:64,88,106` — dialog responsive completo

---

## Architecture Insights

1. **Breakpoint semántico**: `sm:` (640px) se usa para grids de formularios, `md:` (768px) para layout de página (sidebar, card grids). Esta distinción existe en el código pero no está documentada como convención.

2. **Input `text-base`**: Los inputs y textareas ya tienen `text-base` en mobile — esto es importante porque iOS Safari hace zoom automático en inputs con `font-size < 16px`. Si se agrega un input nuevo, debe mantener `text-base` en mobile.

3. **No hay `useMediaQuery`**: Todo el responsive se maneja via CSS (Tailwind breakpoints). El único JS responsive es el toggle del sidebar (`useState`). Esto es correcto para este tipo de app — no introducir hooks de media query a menos que sea absolutamente necesario.

4. **`container` sin configuración**: El `container mx-auto` del layout usa los defaults de Tailwind v4. En pantallas muy anchas el contenido estará centrado con max-width dependiente del breakpoint.

5. **Tablas wide-first**: Todas las tablas se diseñaron pensando en desktop. El `overflow-x-auto` del `Table` base es la única concesión a mobile — es funcional pero no ideal UX.

---

## Open Questions

- ¿Las tablas con muchas columnas (Gastos 10, OrderItems 9) deberían colapsar en cards en mobile o es suficiente el scroll horizontal?
- ¿El `PageHeader` necesita wrapping (`flex-wrap`) o siempre se garantiza que título + acción caben en 1 línea?
- ¿El `OrderItemRow` en mobile debería apilarse en layout vertical (cada campo en su propia fila) o redirigir a la vista de edición individual `order-item-edit-form`?
