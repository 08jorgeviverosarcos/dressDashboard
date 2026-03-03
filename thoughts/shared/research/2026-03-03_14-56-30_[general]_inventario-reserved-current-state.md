---
date: 2026-03-03T14:56:30-0500
researcher: Cursor AI (gpt-5.3-codex)
git_commit: 5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826
branch: main
repository: dressDashboard
topic: "Inventario: uso actual de RESERVED y automatizaciones vigentes"
tags: [research, codebase, inventory, reserved, orders, rentals, payments]
status: complete
last_updated: 2026-03-03
last_updated_by: Cursor AI (gpt-5.3-codex)
---

# Research: Inventario y uso de RESERVED (estado actual)

**Date**: 2026-03-03T14:56:30-0500  
**Researcher**: Cursor AI (gpt-5.3-codex)  
**Git Commit**: `5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

Rehacer la investigación de inventario para validar el estado actual del código y confirmar si hoy se usa `RESERVED`.

## Summary

En el estado actual del repositorio:

- `RESERVED` no aparece en código ejecutable (`src/`, `prisma/`) ni en el enum de Prisma de inventario.
- Los estados implementados hoy para inventario son: `AVAILABLE`, `RENTED`, `SOLD`, `IN_REPAIR`, `RETIRED`.
- Hay actualización de inventario en dos flujos concretos:
  - Pedidos: ajuste de `quantityOnHand` en transiciones específicas de estado del pedido.
  - Rentals: al registrar devolución real, se marca `InventoryItem.status = AVAILABLE` y `usageCount += 1`.
- En pagos, aunque puede cambiar `Order.status`, no hay actualización directa de `InventoryItem`.

## Detailed Findings

### 1) `RESERVED` en código actual

- Búsqueda global de `RESERVED` devuelve coincidencias solo en documentos de `thoughts/` (research/plans), no en `src/` ni `prisma/`.
- El enum actual de inventario en Prisma no incluye `RESERVED`:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/prisma/schema.prisma#L267-L273>
- El default del estado de inventario es `AVAILABLE`:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/prisma/schema.prisma#L64>
- Las etiquetas de UI de inventario mapean exactamente esos cinco estados:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/lib/constants/categories.ts#L105-L111>

### 2) Flujo manual de cambio de estado en inventario

- La tabla de inventario permite cambio manual de estado por fila con `updateInventoryStatus`:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/app/(dashboard)/inventario/inventory-table.tsx#L61-L62>
- Cadena de capas:
  - Action: <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/lib/actions/inventory.ts#L31-L35>
  - Service: <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/inventory/inventory.service.ts#L77-L81>
  - Repo (`updateStatus`): actualiza `status` del `InventoryItem`.

### 3) Automatización en pedidos (cantidad)

- En `orders.service.updateOrderStatus` se decide ajuste de stock con dos condiciones:
  - `QUOTE -> CONFIRMED` (decremento)
  - `* -> CANCELLED` (restauración, excepto si ya era `QUOTE`)
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/orders/orders.service.ts#L78-L89>
- El repo obtiene items de ajuste para productos `QUANTITY`:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/orders/orders.repo.ts#L250-L269>
- La transacción aplica `quantityOnHand: { increment: adj.delta }`:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/orders/orders.repo.ts#L296>

### 4) Automatización en rentals (estado + uso)

- En `rentals.service.updateRental`, al registrar `actualReturnDate` por primera vez, se actualiza inventario de los items vinculados:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/rentals/rentals.service.ts#L52-L55>
- El repo aplica:
  - `usageCount: { increment: 1 }`
  - `status: "AVAILABLE"`
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/rentals/rentals.repo.ts#L69-L70>

### 5) Pagos y estado de pedido (sin update directo de inventario)

- `payments.service.createPayment` deriva nuevo estado de pedido y, si cambia, llama `updateOrderStatusAndCreateAuditLog` en el repo de pagos:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/payments/payments.service.ts#L52-L60>
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/payments/payments.repo.ts#L55>
- Ese camino no pasa por `orders.service.updateOrderStatus` (donde vive el ajuste de `quantityOnHand`), por lo que no hay update directo de `InventoryItem` en ese flujo de pagos.

### 6) Consulta de unidades disponibles

- Existe consulta explícita de inventario unitario disponible que filtra `status: "AVAILABLE"`:
  - <https://github.com/08jorgeviverosarcos/dressDashboard/blob/5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826/src/features/inventory/inventory.repo.ts#L101-L105>

## Code References

- `prisma/schema.prisma:64` - default de estado de inventario en `AVAILABLE`.
- `prisma/schema.prisma:267-273` - enum `InventoryStatus` (sin `RESERVED`).
- `src/lib/constants/categories.ts:105-111` - etiquetas de estados de inventario.
- `src/app/(dashboard)/inventario/inventory-table.tsx:61-62` - cambio manual de estado desde UI.
- `src/lib/actions/inventory.ts:31-35` - action `updateInventoryStatus`.
- `src/features/inventory/inventory.service.ts:77-81` - delegación de update de estado.
- `src/features/orders/orders.service.ts:78-89` - reglas de ajuste de cantidad por cambio de estado.
- `src/features/orders/orders.repo.ts:250-269` - selección de items para ajuste de stock.
- `src/features/orders/orders.repo.ts:296` - update de `quantityOnHand`.
- `src/features/rentals/rentals.service.ts:52-55` - trigger de devolución.
- `src/features/rentals/rentals.repo.ts:69-70` - `usageCount++` y `status=AVAILABLE`.
- `src/features/payments/payments.service.ts:52-60` - derivación y update de estado de pedido vía pagos.
- `src/features/payments/payments.repo.ts:55` - update de estado de pedido + auditoría.
- `src/features/inventory/inventory.repo.ts:101-105` - filtro de unidades disponibles.

## Architecture Insights

- Se mantiene patrón por capas `actions -> services -> repos`.
- Automatización de inventario hoy es puntual por evento de negocio:
  - Pedidos: cantidad (`quantityOnHand`) bajo reglas de transición de estado.
  - Rentals: estado/uso al retorno real.
- El concepto `RESERVED` aparece en documentación histórica/planes, pero no en implementación activa del dominio actual.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`  
  Incluye la investigación anterior y menciona `RESERVED` como estado potencial/intermedio.
- `thoughts/shared/research/2026-02-26_13-05-41_[general]_inventario-unidad-vs-cantidad-estado-actual.md`  
  Contexto de estado de inventario y asignación de `inventoryItemId`.
- `thoughts/shared/plans/2026-02-26_19-52-29_[general]_inventario-unidad-vs-cantidad-implementacion.md`  
  Registra explícitamente que `RESERVED` quedó fuera de alcance en ese plan.

## Related Research

- `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`
- `thoughts/shared/research/2026-02-26_13-05-41_[general]_inventario-unidad-vs-cantidad-estado-actual.md`
- `thoughts/shared/research/2026-02-25_13-39-25_[general]_pedidos-estado-automatizaciones-current-state.md`
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`

## Open Questions

- En caso de requerirse estado intermedio de inventario, ¿cuál sería el evento de negocio oficial para transición a ese estado?
- ¿Se desea unificar el ajuste de stock de `QUANTITY` para todos los caminos de cambio de estado de pedido (incluyendo los originados por pagos)?
