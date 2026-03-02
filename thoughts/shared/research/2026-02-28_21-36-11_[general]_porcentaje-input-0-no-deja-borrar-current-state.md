---
date: 2026-02-28T21:36:11-0500
researcher: gpt-5.3-codex
git_commit: 72dfb8126f1c3d50f6c15cffc5b3275aefd92ff8
branch: main
repository: dressDashboard
topic: "En campos numéricos como porcentaje aparece 0 y no deja borrar (estado actual)"
tags: [research, codebase, orders, percentage-input, numeric-input, forms]
status: complete
last_updated: 2026-02-28
last_updated_by: gpt-5.3-codex
---

# Research: En campos numéricos como porcentaje aparece 0 y no deja borrar (estado actual)

**Date**: 2026-02-28T21:36:11-0500  
**Researcher**: gpt-5.3-codex  
**Git Commit**: `72dfb8126f1c3d50f6c15cffc5b3275aefd92ff8`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

`/research_codebase en campos numéricos como porcentaje, aparece 0 y si uno quiere escribir no deja borrar el 0 entonces toca poner 030, para que sea 30 por ejemplo`

## Summary

En el estado actual, los campos de porcentaje relevantes en pedidos usan inputs numéricos controlados con conversión inmediata a `number` (`Number(e.target.value)`) y con fallback visual a `0` (`value={... ?? 0}` o estado numérico).  
Con esa implementación, cuando el input se vacía durante edición, el flujo vuelve a `0`, y en tecleo puede observarse el patrón de prefijo `0` (por ejemplo `030`) antes de quedar en `30`.

## Detailed Findings

### Campos de porcentaje en UI (pedidos)

- `src/components/orders/OrderItemRow.tsx` usa el campo de descuento porcentual con `value={item.discountValue ?? 0}` y `onChange` con `Number(e.target.value)`.
- `src/app/(dashboard)/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx` repite el mismo patrón para edición de item.
- `src/components/orders/OrderForm.tsx` define `% Abono Mínimo` con `Input type="number"` y `setMinPct(Number(e.target.value))`.

### Conversión de input durante escritura/borrado

- En los tres puntos anteriores, el evento `onChange` convierte el texto del input a número en cada pulsación.
- Al borrar contenido, `e.target.value` pasa por `''`; `Number('')` produce `0`.
- En descuento porcentual además hay fallback de renderizado `?? 0`, por lo que el input vuelve a mostrar `0` cuando el estado queda `null`/`undefined`.

### Flujo de datos y validación para porcentaje

- Los formularios de pedido envían `discountValue`/`minDownpaymentPct` hacia server actions de órdenes.
- `src/lib/actions/orders.ts` valida con `orderSchema.safeParse` y `orderItemSchema.safeParse`.
- `src/lib/validations/order.ts` acepta `discountValue` como número `>= 0` (nullable/optional) y `minDownpaymentPct` como número `0..100` con default `30`.
- En servicios de órdenes, el cálculo usa fallback numérico `const discountVal = data.discountValue ?? 0` en rama de porcentaje.

### Componentes numéricos reutilizables relacionados

- `src/components/shared/MoneyInput.tsx` es controlado y renderiza `value ?? ""`.
- El problema reportado aquí se observa específicamente en inputs de porcentaje hechos con `Input type="number"` + `Number(...)` en formularios de pedidos.

## Code References

- `src/components/orders/OrderItemRow.tsx:319` - `value={item.discountValue ?? 0}`
- `src/components/orders/OrderItemRow.tsx:321` - `onChange={(e) => onChange(index, "discountValue", Number(e.target.value))}`
- `src/app/(dashboard)/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx:283` - `value={discountValue ?? 0}`
- `src/app/(dashboard)/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx:285` - `onChange={(e) => setDiscountValue(Number(e.target.value))}`
- `src/components/orders/OrderForm.tsx:314` - label `% Abono Mínimo`
- `src/components/orders/OrderForm.tsx:315` - `value={minPct}` + `setMinPct(Number(e.target.value))`
- `src/lib/validations/order.ts:13` - `discountValue: z.number().min(0).optional().nullable()`
- `src/lib/validations/order.ts:39` - `minDownpaymentPct: z.number().min(0).max(100).default(30)`
- `src/lib/actions/orders.ts:21` - `orderSchema.safeParse(data)` en create
- `src/lib/actions/orders.ts:32` - `orderSchema.safeParse(data)` en update
- `src/lib/actions/orders.ts:80` - `orderItemSchema.safeParse(data)` en update item
- `src/features/orders/orders.service.ts:120` - `const discountVal = data.discountValue ?? 0`
- `src/features/orders/orders.service.ts:124` - rama `discountType === "PERCENTAGE"`

## Architecture Insights

- En pedidos, los porcentajes se manejan como estado numérico controlado en UI.
- La validación de rango/tipo está en Zod dentro de server actions.
- El cálculo financiero mantiene fallback numérico a `0` cuando `discountValue` no está definido.
- El flujo porcentual queda trazado en capas UI → actions → service → repo sin rutas API.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md` - Documenta patrón actual de inputs numéricos en formularios y `% Abono Mínimo`.
- `thoughts/shared/research/2026-02-25_13-17-31_[general]_eliminar-abono-minimo-pedidos-current-state.md` - Mapea uso de `minDownpaymentPct` en modelo, formulario y regla de negocio.
- `thoughts/shared/plans/2026-02-21_11-00-00_[general]_ordernumber-manual-input.md` - Incluye patrón de manejo numérico en `onChange` con conversión inmediata.

## Related Research

- `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md`
- `thoughts/shared/research/2026-02-25_13-17-31_[general]_eliminar-abono-minimo-pedidos-current-state.md`
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`

## Open Questions

- No se detectaron preguntas abiertas adicionales para describir el estado actual de este comportamiento en porcentaje.
