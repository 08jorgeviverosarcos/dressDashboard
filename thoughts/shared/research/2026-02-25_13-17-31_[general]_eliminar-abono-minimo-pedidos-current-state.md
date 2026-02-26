---
date: 2026-02-25T13:17:31-0500
researcher: gpt-5.3-codex
git_commit: 64bfb5dd3b8a8965820ae3fa73105a573d37b88a
branch: main
repository: dressDashboard
topic: "Eliminar abono minimo de pedidos, quitar completamente esto (estado actual en código)"
tags: [research, codebase, orders, payments, minDownpaymentPct]
status: complete
last_updated: 2026-02-25
last_updated_by: gpt-5.3-codex
---

# Research: Eliminar abono minimo de pedidos, quitar completamente esto (estado actual)

**Date**: 2026-02-25T13:17:31-0500  
**Researcher**: gpt-5.3-codex  
**Git Commit**: `64bfb5dd3b8a8965820ae3fa73105a573d37b88a`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

`/research_codebase eliminar abono minimo de pedidos, quitar completamente esto`

## Summary

En el estado actual, el concepto de abono mínimo de pedidos está modelado por `minDownpaymentPct` y aparece en base de datos, validaciones, formulario de pedido, vista de detalle, persistencia de órdenes y transición de estado al registrar pagos.

Su uso funcional principal está en la regla de negocio que cambia `Order.status` de `QUOTE` a `CONFIRMED` cuando el porcentaje pagado alcanza o supera `minDownpaymentPct`.

## Detailed Findings

### Modelo de datos (Prisma + migración)

- `Order` define el campo `minDownpaymentPct` como decimal con default 30 en Prisma:  
  [`prisma/schema.prisma:89`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/prisma/schema.prisma#L89)
- La migración inicial crea la columna con el mismo default:  
  [`prisma/migrations/20260217163331_init/migration.sql:83`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/prisma/migrations/20260217163331_init/migration.sql#L83)
- El seed de órdenes carga `minDownpaymentPct: 30` en varios registros:  
  [`prisma/seed.ts:198`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/prisma/seed.ts#L198), [`prisma/seed.ts:259`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/prisma/seed.ts#L259), [`prisma/seed.ts:305`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/prisma/seed.ts#L305), [`prisma/seed.ts:338`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/prisma/seed.ts#L338)

### UI de pedidos (captura y visualización)

- En el formulario de pedido (`OrderForm`) existe estado local `minPct` con default 30, se envía como `minDownpaymentPct` y se renderiza un input con etiqueta `% Abono Mínimo`:  
  [`src/components/orders/OrderForm.tsx:99`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/components/orders/OrderForm.tsx#L99), [`src/components/orders/OrderForm.tsx:163`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/components/orders/OrderForm.tsx#L163), [`src/components/orders/OrderForm.tsx:283`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/components/orders/OrderForm.tsx#L283)
- En edición de pedido, `minDownpaymentPct` se carga en `initialData`:  
  [`src/app/pedidos/[id]/editar/page.tsx:47`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/app/pedidos/%5Bid%5D/editar/page.tsx#L47)
- En detalle de pedido se muestra texto de solo lectura `Abono mínimo: X%`:  
  [`src/app/pedidos/[id]/page.tsx:124`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/app/pedidos/%5Bid%5D/page.tsx#L124)

### Validación y persistencia

- El schema Zod del pedido valida `minDownpaymentPct` con rango 0..100 y default 30:  
  [`src/lib/validations/order.ts:38`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/lib/validations/order.ts#L38)
- En repo de órdenes, el valor se persiste tanto en `create` como en `updateInTransaction`:  
  [`src/features/orders/orders.repo.ts:77`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/features/orders/orders.repo.ts#L77), [`src/features/orders/orders.repo.ts:150`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/features/orders/orders.repo.ts#L150)

### Uso en pagos y transición de estado

- Al crear un pago, el servicio de pagos llama `deriveStatusAfterPayment` pasando `order.minDownpaymentPct`:  
  [`src/features/payments/payments.service.ts:52`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/features/payments/payments.service.ts#L52)
- La regla que aplica abono mínimo está en `status.ts`: si `currentStatus === "QUOTE"` y `paidPct >= minPct`, retorna `CONFIRMED`:  
  [`src/lib/business/status.ts:16`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/lib/business/status.ts#L16)
- En la misma función existe regla adicional independiente para cierre en `DELIVERED` con 100% pagado:  
  [`src/lib/business/status.ts:20`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/lib/business/status.ts#L20)

### Cobertura de tests relacionada

- Validación del default 30 y rechazo de >100 en tests de schema de orden:  
  [`src/lib/validations/order.test.ts:171`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/lib/validations/order.test.ts#L171), [`src/lib/validations/order.test.ts:179`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/lib/validations/order.test.ts#L179)
- Casos de negocio para QUOTE/CONFIRMED con `minPct` en tests de estado:  
  [`src/lib/business/status.test.ts:68`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/lib/business/status.test.ts#L68), [`src/lib/business/status.test.ts:95`](https://github.com/08jorgeviverosarcos/dressDashboard/blob/64bfb5dd3b8a8965820ae3fa73105a573d37b88a/src/lib/business/status.test.ts#L95)

## Flujo actual (de extremo a extremo)

1. `OrderForm` envía `minDownpaymentPct` al crear/editar pedido.
2. Server action de órdenes valida con `orderSchema`.
3. Servicio de órdenes delega a repo.
4. Repo persiste `minDownpaymentPct` en `Order`.
5. Al registrar pagos, `payments.service` calcula estado derivado con `deriveStatusAfterPayment`.
6. Si el pedido estaba en `QUOTE` y el porcentaje pagado alcanza el mínimo, cambia a `CONFIRMED`.

## Code References

- `prisma/schema.prisma:89` - Campo `minDownpaymentPct` en `Order`.
- `prisma/migrations/20260217163331_init/migration.sql:83` - Columna SQL con default 30.
- `src/components/orders/OrderForm.tsx:99` - Estado local `minPct`.
- `src/components/orders/OrderForm.tsx:163` - Payload `minDownpaymentPct`.
- `src/components/orders/OrderForm.tsx:283` - Label `% Abono Mínimo`.
- `src/app/pedidos/[id]/editar/page.tsx:47` - Mapeo a `initialData`.
- `src/app/pedidos/[id]/page.tsx:124` - Render `Abono mínimo`.
- `src/lib/validations/order.ts:38` - Regla Zod 0..100 default 30.
- `src/features/orders/orders.repo.ts:77` - Persistencia en create.
- `src/features/orders/orders.repo.ts:150` - Persistencia en update.
- `src/features/payments/payments.service.ts:52` - Llamada a `deriveStatusAfterPayment`.
- `src/lib/business/status.ts:16` - Regla QUOTE→CONFIRMED por mínimo.
- `src/lib/business/status.ts:20` - Regla DELIVERED→COMPLETED por 100%.
- `src/lib/validations/order.test.ts:171` - Test default 30.
- `src/lib/business/status.test.ts:68` - Test de umbral mínimo.

## Architecture Insights

- El abono mínimo existe como atributo persistente del pedido (`Order.minDownpaymentPct`).
- La validación de rango vive en schema de entrada de órdenes.
- La UI lo expone tanto en formulario (editable) como en detalle (lectura).
- La aplicación de la regla ocurre en el flujo de pagos al derivar estado.
- El criterio de transición por abono mínimo está encapsulado en helper de negocio (`deriveStatusAfterPayment`), consumido por `payments.service`.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`  
  - Registra que `Order` contiene `minDownpaymentPct` dentro del estado de modelo financiero vigente.
- `thoughts/shared/research/2026-02-22_15-54-15_[general]_testing-strategy-codebase-analysis.md`  
  - Documenta explícitamente la regla `QUOTE -> CONFIRMED` al alcanzar `minDownpaymentPct`.
- `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md`  
  - Lista `% abono mínimo` como input numérico actual en formularios.

## Related Research

- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
- `thoughts/shared/research/2026-02-22_15-54-15_[general]_testing-strategy-codebase-analysis.md`
- `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md`
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`

## Open Questions

- No se detectaron preguntas abiertas adicionales para ubicar el estado actual del abono mínimo; el rastro en código es consistente entre modelo, UI, validación, persistencia y regla de pagos.
