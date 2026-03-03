---
date: 2026-03-02T17:40:39-0500
researcher: Cursor (gpt-5.3-codex)
git_commit: cd519ed7ac3aff06b41e2547232650f40fb5fbc6
branch: main
repository: dressDashboard
topic: "elimina todo lo relacionado a rentalCost"
tags: [research, codebase, rentals, rentalcost, prisma, orders]
status: complete
last_updated: 2026-03-02
last_updated_by: Cursor (gpt-5.3-codex)
---

# Research: elimina todo lo relacionado a rentalCost

**Date**: 2026-03-02T17:40:39-0500  
**Researcher**: Cursor (gpt-5.3-codex)  
**Git Commit**: `cd519ed7ac3aff06b41e2547232650f40fb5fbc6`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question
`/research_codebase elimina todo lo relacionado a rentalCost`

## Summary
`rentalCost` existe hoy como subentidad de `Rental` en Prisma y se usa en flujo de detalle de item de pedido tipo `RENTAL`.  
La gestión actual incluye crear costo, listar costos y hacer soft-delete del costo desde UI, con Server Actions y capa service/repo separadas.  
Además, hay soft-delete en cascada de `rentalCost` cuando se elimina una orden o un item de orden con rental asociado.

## Detailed Findings

### Prisma y modelo de datos
- `Rental` declara relación `costs: RentalCost[]` y `RentalCost` define `rentalId`, `type`, `amount`, `description`, `deletedAt`.
- `RentalCost` tiene `@@index([rentalId])` y `@@index([deletedAt])`.
- Relación `RentalCost -> Rental` usa `onDelete: Cascade`.

### Lectura/escritura en repositorio de rentals
- La lectura de rental por `orderItemId` incluye `costs` filtrados por `deletedAt: null` y ordenados por `type`.
- `createCost` persiste en `prisma.rentalCost.create`.
- `deleteCost` aplica soft-delete con `prisma.rentalCost.update({ deletedAt: new Date() })`.

### Servicios y acciones
- `addRentalCost` valida existencia de rental y de pedido (`orderId`) antes de crear costo.
- `deleteRentalCost` valida existencia del costo y de su pedido asociado antes de soft-delete.
- Server Action `addRentalCost` valida con `rentalCostSchema.safeParse`, delega al servicio y revalida `/pedidos/{orderId}`.
- Server Action `deleteRentalCost` delega y revalida `/pedidos/{orderId}`.

### UI donde aparece
- `RentalManager` (detalle de item de pedido) importa `addRentalCost`/`deleteRentalCost`.
- Muestra `Costos del Alquiler`, lista de costos, total de costos (`totalCosts`) y diálogo para agregar costo.
- Elimina costo con `ConfirmDialog`.

### Integración con módulo de orders
- En consultas de orden/item, se incluyen `rental.costs` filtrados por `deletedAt: null`.
- En borrado de orden (`deleteWithCascade`) se hace soft-delete masivo de `rentalCost` por `rentalId`.
- En borrado de item (`deleteOrderItemAndUpdateTotals`) también se hace soft-delete de `rentalCost` del rental ligado.

### Datos y scripts
- `prisma_import.ts` importa `rentalCosts.json` y ejecuta `tx.rentalCost.createMany`.
- Existe dataset `data/rentalCosts.json`.

## Code References
- `prisma/schema.prisma:176-202` - Modelos `Rental` y `RentalCost` y relación entre ambos.
- `src/features/rentals/rentals.repo.ts:3-20` - Include de `costs` con filtro soft-delete.
- `src/features/rentals/rentals.repo.ts:83-101` - Crear costo, buscar costo, soft-delete de costo.
- `src/features/rentals/rentals.service.ts:69-105` - Flujos de negocio `addRentalCost` y `deleteRentalCost`.
- `src/lib/actions/rentals.ts:40-61` - Server Actions `addRentalCost` y `deleteRentalCost`.
- `src/lib/validations/rental.ts:10-15` - `rentalCostSchema`.
- `src/app/(dashboard)/pedidos/[id]/items/[itemId]/rental-manager.tsx:98-130` - Handlers UI para agregar/eliminar costo.
- `src/app/(dashboard)/pedidos/[id]/items/[itemId]/rental-manager.tsx:203-279` - Render/listado/diálogo de costos.
- `src/features/orders/orders.repo.ts:322-327` - Cascade soft-delete `rentalCost` al borrar orden.
- `src/features/orders/orders.repo.ts:452-456` - Cascade soft-delete `rentalCost` al borrar item.
- `prisma_import.ts:55-130` - Carga `rentalCosts` en script de importación.

## Architecture Insights
- Patrón en uso: UI -> Server Actions -> Service -> Repository -> Prisma.
- `rentalCost` está acoplado al ciclo de vida de `Rental`/`OrderItem` en detalle de pedido.
- Soft-delete está implementado explícitamente para `rentalCost` en operaciones de eliminación.
- Validación de entrada para costos se centraliza en Zod (`rentalCostSchema`) en acción server.

## Historical Context (from thoughts/)
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md` - Mapa completo del módulo rentals y presencia de `RentalCost`.
- `thoughts/shared/research/2026-02-19_17-01-20_[general]_rental-orderitem-relacion-1-1-opcional.md` - Relación `Rental`/`OrderItem` y contexto de costos.
- `thoughts/shared/research/2026-02-20_17-02-13_[general]_orderitem-detail-view-rental-inline-refactor.md` - Flujo inline de gestión de costos en UI.
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md` - Flujo funcional de items `RENTAL` y costos.
- `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md` - Reglas de captura monetaria vinculadas a montos.

## Related Research
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md`
- `thoughts/shared/research/2026-02-19_17-01-20_[general]_rental-orderitem-relacion-1-1-opcional.md`
- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
- `thoughts/shared/research/2026-02-20_17-02-13_[general]_orderitem-detail-view-rental-inline-refactor.md`
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`

## Open Questions
- No se pudo generar permalink GitHub porque `gh` no está disponible en este entorno.
- Si el objetivo siguiente es implementación, falta confirmar alcance exacto de “eliminar todo” (solo código runtime vs también esquema Prisma, migraciones, importadores y data JSON).
