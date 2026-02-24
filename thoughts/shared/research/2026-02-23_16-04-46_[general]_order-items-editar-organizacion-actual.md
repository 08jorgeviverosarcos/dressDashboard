---
date: 2026-02-23T16:04:46-0500
researcher: gpt-5.3-codex
git_commit: 2209ca31edad61db10bc28a3e26d08571f4abc26
branch: main
repository: dressDashboard
topic: "Items del pedido en edición: organización actual de la tabla/sección"
tags: [research, codebase, orders, order-items, ui]
status: complete
last_updated: 2026-02-23
last_updated_by: gpt-5.3-codex
---

# Research: Items del pedido en edición (estado actual)

**Date**: 2026-02-23T16:04:46-0500  
**Researcher**: gpt-5.3-codex  
**Git Commit**: `2209ca31edad61db10bc28a3e26d08571f4abc26`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

/research_codebase puedes revisar bien items del pedido en editar en la page de pedido y organizarla mejor, porfavor quiero que como un teach lead y como UI/UX senior, me dejes organizada esa tabla. el subtotal aparece abajo eso esta mas desorganizado, analiza porfavor y miremos que cambios hacemos

## Summary

La edición de pedido (`/pedidos/[id]/editar`) usa un formulario en tarjeta (`OrderForm`) que renderiza items en bloques repetibles (`OrderItemRow`) y no una tabla tradicional editable por filas.  
Cada bloque de item tiene: cabecera con índice y acción de eliminar, una primera fila de campos principales (incluyendo subtotal por item), una segunda fila de descripción/descuento y una tercera fila condicional para alquiler (fecha devolución + depósito).  
Los totales globales del pedido (`Total Precio`, `Total Costo`) se muestran al final de la sección de items en el `OrderForm`, separados por `Separator`.

## Detailed Findings

### 1) Punto de entrada de la edición de pedido

- La ruta `/pedidos/[id]/editar` carga pedido, clientes y productos, y delega toda la UI a `OrderForm` (`src/app/pedidos/[id]/editar/page.tsx`).
- `initialData.items` incluye `itemType`, precios, descuentos, `rentalReturnDate` y `rentalDeposit` para hidratar la sección de items.

### 2) Estructura real de “tabla/items” en edición

- `OrderForm` renderiza la sección **Items del Pedido** dentro de un `Card` y hace `map` de `items` a `OrderItemRow` (`src/components/orders/OrderForm.tsx`).
- Cada `OrderItemRow` es un bloque con borde (`rounded-md border p-3`), no un `<table>`.
- Cabecera del bloque:
  - izquierda: `Item {index + 1}`
  - derecha: botón eliminar (`Button variant="ghost" size="icon"` con `Trash2`)
- Primera fila del grid de 12 columnas:
  - `Tipo`, `Producto/Nombre`, `Cant.`, `Precio Unit.`, `Costo`, `Subtotal`
  - `Subtotal` se renderiza en la última celda de esa fila (`col-span-3 text-right`)
- Segunda fila:
  - `Descripción`, `Tipo descuento`, `Descuento`
- Tercera fila condicional (`itemType === "RENTAL"`):
  - `Fecha Devolución`, `Depósito`

### 3) Ubicación y cálculo de subtotal/totales

- Subtotal por item se calcula dentro de `OrderItemRow`:
  - base: `quantity * unitPrice`
  - descuento fijo: resta monto
  - descuento porcentaje: aplica factor `(1 - porcentaje/100)`
- Totales globales se calculan en `OrderForm`:
  - `itemsSubtotal` = suma de subtotales de cada item
  - `totalPrice` = `itemsSubtotal + adjustmentAmount`
  - `totalCost` = suma de `quantity * costAmount`
- Totales visuales al final de la sección:
  - `Total Precio` (destacado)
  - `Total Costo`

### 4) Flujo de acción de eliminar en edición

- En edición inline (`OrderItemRow`), eliminar opera sobre estado local (`onRemove(index)`), con guardia para no dejar 0 items.
- En tabla de detalle de pedido (`OrderItemsTable`) sí se usa `ConfirmDialog` para eliminación persistente en backend (`deleteOrderItem`).

### 5) Flujo de datos entre capas (editar pedido con items)

- UI (`OrderForm`) arma `OrderFormData` y llama `updateOrder` (`src/lib/actions/orders.ts`).
- Action valida con `orderSchema` y delega a `orders.service`.
- Service delega a repo (`updateInTransaction`) para persistir pedido + recrear items y sincronizar rentals.
- Validación relevante de item: `orderItemSchema` en `src/lib/validations/order.ts` (tipo, producto, precios, descuentos, costo, fechas/deposito rental).

## Code References

- `src/app/pedidos/[id]/editar/page.tsx:13-67` - Ruta de edición de pedido y mapeo de `initialData.items`.
- `src/components/orders/OrderForm.tsx:270-301` - Sección visual de `Items del Pedido`, botón agregar, separator y totales.
- `src/components/orders/OrderForm.tsx:101-113` - Cálculo de `itemsSubtotal`, `totalPrice`, `totalCost`.
- `src/components/orders/OrderItemRow.tsx:88-169` - Cabecera del item + primera fila con subtotal en la misma fila de edición principal.
- `src/components/orders/OrderItemRow.tsx:171-255` - Fila de descuento y fila condicional de rental (`Fecha Devolución`, `Depósito`).
- `src/components/orders/OrderItemRow.tsx:77-86` - Cálculo de subtotal por item.
- `src/app/pedidos/[id]/order-items-table.tsx:52-159` - Patrón de tabla en detalle de pedido (incluye acciones y columna subtotal/deposito).
- `src/lib/actions/orders.ts:31-43` - Action `updateOrder` y revalidación.
- `src/features/orders/orders.service.ts:51-60` - Servicio `updateOrder`.
- `src/features/orders/orders.repo.ts:112-196` - Persistencia en transacción al actualizar pedido/items.
- `src/lib/validations/order.ts:3-43` - Esquemas Zod de item y pedido.

## Architecture Insights

- La edición de pedido está modelada como formulario compuesto con bloques repetibles (`OrderItemRow`) y no como una data table editable.
- Hay separación entre:
  - **Edición inline de múltiples items** (`OrderForm` + `OrderItemRow`).
  - **Edición detallada de un único item** (`order-item-edit-form.tsx`).
  - **Visualización tabular de items en detalle del pedido** (`OrderItemsTable`).
- El cálculo financiero (subtotal/totales) se hace en UI y luego se envía al backend, donde se persiste mediante service/repo.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md` - Documento histórico sobre evolución de rental/depósito/ajustes (estado levantado en esa fecha).
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md` - Documento histórico del flujo de OrderItem, descuentos y rental (estado en esa fecha).
- `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md` - Inventario de uso de `MoneyInput` en pedidos/rentals.
- `thoughts/shared/plans/2026-02-20_18-09-05_[general]_orderitem-type-discount-rental-inline.md` - Plan histórico del enfoque “rental inline” en order items.

## Related Research

- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
- `thoughts/shared/research/2026-02-20_17-02-13_[general]_orderitem-detail-view-rental-inline-refactor.md`
- `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md`

## Open Questions

- ¿Quieres que evaluemos la **sección de edición inline** (`OrderItemRow`) como prioridad principal, o también la consistencia con la vista tabular (`OrderItemsTable`) del detalle de pedido?
- ¿El término “tabla” en tu solicitud se refiere a:
  - la grilla visual de cada `OrderItemRow`, o
  - la tabla de `OrderItemsTable` en la vista detalle del pedido?
- ¿Deseas que el próximo paso sea solo propuesta de estructura UX (sin código) o implementación directa?
