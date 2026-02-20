---
date: 2026-02-20T15:48:09-0500
researcher: Cursor AI
git_commit: ee10008c199d93fbcd1d2b08d539d581e8b5f059
branch: main
repository: dressDashboard
topic: "Estado actual de chargedIncome en Rental y cálculo de total para posibles ajustes/deposito"
tags: [research, codebase, orders, rentals, orderitem, prisma]
status: complete
last_updated: 2026-02-20
last_updated_by: Cursor AI
---

# Research: Estado actual de chargedIncome en Rental y cálculo de total para posibles ajustes/deposito

**Date**: 2026-02-20T15:48:09-0500  
**Researcher**: Cursor AI  
**Git Commit**: `ee10008c199d93fbcd1d2b08d539d581e8b5f059`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

Documentar cómo está implementado hoy el flujo donde en `rental` existe `chargedIncome`, y cómo se relaciona con total de orden, además del estado actual de `pickupDate` y si existen conceptos de ajuste (`adjustmentAmount`, `adjustmentReason`) o depósito (`deposit`) en el modelo actual.

## Summary

Hoy, `chargedIncome` existe en `Rental` y no modifica `Order.totalPrice`.  
El total de la orden se calcula en UI como suma de items con descuento por item y se persiste en backend sin recálculo.  
`pickupDate` existe en `Rental` y también se captura desde el formulario de items de pedido para items tipo `RENTAL`.  
No existen actualmente en el esquema campos `adjustmentAmount`, `adjustmentReason` en `Order`, ni `deposit` en `Rental`.

## Detailed Findings

### 1) Estado actual del modelo de datos (Prisma)

- `Order` define `totalPrice`, `totalCost`, `minDownpaymentPct` y no contiene campos de ajuste por valor/motivo.
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/prisma/schema.prisma#L67-L89
- `OrderItem` define `itemType`, `discountType`, `discountValue`, que sí afectan subtotales por item en UI.
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/prisma/schema.prisma#L91-L114
- `Rental` contiene `pickupDate`, `returnDate`, `actualReturnDate`, `chargedIncome`; no contiene `deposit`.
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/prisma/schema.prisma#L153-L164

### 2) Cómo se calcula actualmente el total de la orden

- En `OrderForm`, `totalPrice` se calcula con reduce de items:
  - base: `quantity * unitPrice`
  - descuento fijo: resta `discountValue`
  - descuento porcentaje: multiplica por `(1 - discountValue / 100)`
- `totalCost` se calcula como suma de `quantity * costAmount`.
- Ambos valores se envían en el payload al crear/editar.
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/src/components/orders/OrderForm.tsx#L94-L104
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/src/components/orders/OrderForm.tsx#L137-L160

### 3) Persistencia de totalPrice/totalCost en backend

- `orders.service.ts` recibe el `OrderFormData` ya calculado y delega al repo.
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/src/features/orders/orders.service.ts#L16-L22
- `orders.repo.ts` persiste `totalPrice` y `totalCost` directamente en create/update transaction.
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/src/features/orders/orders.repo.ts#L61-L70
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/src/features/orders/orders.repo.ts#L124-L131

### 4) Relación actual de Rental con items tipo RENTAL

- Al crear pedido, por cada item `RENTAL`, se crea un `Rental` con:
  - `orderItemId`
  - `pickupDate` desde `rentalPickupDate`
  - `returnDate` desde `rentalReturnDate`
  - `chargedIncome: 0`
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/src/features/orders/orders.service.ts#L23-L35
- En actualización de pedido, el repo re-asocia rentals huérfanos o crea nuevos, manteniendo `chargedIncome: 0` para nuevos.
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/ee10008c199d93fbcd1d2b08d539d581e8b5f059/src/features/orders/orders.repo.ts#L153-L187

### 5) Uso funcional de chargedIncome hoy

- `chargedIncome` forma parte de `Rental` y se usa en lógica de utilidad para ganancia de alquiler (`income - costs`), no como parte del total de orden.
- En el flujo de creación/gestión de alquiler, puede inicializarse con base en total de orden según UI de rental manager (documentado en research/plans existentes).

## Code References

- `prisma/schema.prisma` - Modelos `Order`, `OrderItem`, `Rental` y campos actuales relevantes.
- `src/components/orders/OrderForm.tsx` - Cálculo de `totalPrice`/`totalCost` y payload enviado.
- `src/components/orders/OrderItemRow.tsx` - Cálculo de subtotal por item con descuento.
- `src/features/orders/orders.service.ts` - Creación de rentals para items `RENTAL`.
- `src/features/orders/orders.repo.ts` - Persistencia de orden e items, re-asociación/creación de rentals en update.
- `src/lib/validations/order.ts` - Esquema de entrada del pedido (`totalPrice`, `totalCost`, `discounts`, fechas rental).
- `src/lib/validations/rental.ts` - Esquema de rental con `chargedIncome`, `pickupDate`, `returnDate`.

## Architecture Insights

- El total de orden está centrado en `OrderForm` (UI) y no se recalcula en servicios/repositorio.
- `Rental` está ligado a `OrderItem` (1:1 opcional), no directamente a `Order`.
- `chargedIncome` y rentabilidad de alquiler viven como concepto separado del total financiero principal de `Order`.
- El mecanismo de ajuste financiero existente en el flujo de pedidos hoy está modelado como descuento por item (`discountType`, `discountValue`) y no como ajuste global de orden.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
  - Documenta la incorporación de `itemType`, descuentos, `name` y rental inline con `pickupDate`/`returnDate`.
- `thoughts/shared/plans/2026-02-20_18-09-05_[general]_orderitem-type-discount-rental-inline.md`
  - Plan de implementación del flujo actual de order items y rental inline.
- `thoughts/shared/research/2026-02-19_17-01-20_[general]_rental-orderitem-relacion-1-1-opcional.md`
  - Contexto de migración de relación `Rental -> OrderItem`.
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`
  - Descripción histórica del módulo rentals y uso de `chargedIncome`.

## Related Research

- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
- `thoughts/shared/research/2026-02-19_17-01-20_[general]_rental-orderitem-relacion-1-1-opcional.md`
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md`
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`

## Open Questions

- Para la definición futura de ajuste global en orden, el código actual no expone un concepto equivalente a `adjustmentAmount`/`adjustmentReason`; solo existe descuento por item.
- Para depósito en alquiler, el modelo actual no contiene `deposit` y no hay documentos en `thoughts/` que definan este campo como estado vigente.
