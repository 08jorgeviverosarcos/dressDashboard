---
date: 2026-03-03T15:55:05-0500
researcher: Cursor AI (gpt-5.3-codex)
git_commit: 5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826
branch: main
repository: dressDashboard
topic: "Comparativo: inventario y RESERVED (2026-02-26 vs estado actual)"
tags: [research, codebase, inventory, reserved, diff, orders, rentals]
status: complete
last_updated: 2026-03-03
last_updated_by: Cursor AI (gpt-5.3-codex)
---

# Research: Comparativo inventario (2026-02-26 vs actual)

**Date**: 2026-03-03T15:55:05-0500  
**Researcher**: Cursor AI (gpt-5.3-codex)  
**Git Commit**: `5f2dd76d3f5a86c0cbbfdc051ceb606885e8d826`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

Generar un comparativo breve entre la investigación anterior (`2026-02-26`) y el estado actual del código, con foco en si se usa `RESERVED`.

## Summary

- `RESERVED` **sigue sin usarse** en implementación activa.
- El cambio más importante frente al reporte anterior es que ahora sí existe automatización de `quantityOnHand` en un flujo de pedidos (por transición de estado).
- Se mantiene la automatización de devolución en rentals (`status -> AVAILABLE`, `usageCount++`).

## Comparativo Breve

### 1) Uso de `RESERVED`

**Antes (2026-02-26):**
- Se reportaba como estado potencial/intermedio en documentación, no confirmado en implementación.

**Ahora (actual):**
- No está en enum de Prisma ni en labels de UI.
- Solo aparece en documentos de `thoughts/`.

**Evidencia actual:**
- Enum de inventario sin `RESERVED`:
  - `prisma/schema.prisma:267-273`
- Labels de estado actuales:
  - `src/lib/constants/categories.ts:105-111`

### 2) Automatización de cantidad (`quantityOnHand`)

**Antes (2026-02-26):**
- La investigación anterior indicaba que no había automatización activa de cantidad en flujos de pedidos/rentas/pagos.

**Ahora (actual):**
- Sí hay ajuste de `quantityOnHand` en cambios de estado de pedido:
  - Decremento en `QUOTE -> CONFIRMED`.
  - Restauración en cancelación (`-> CANCELLED` bajo condición del estado previo).

**Evidencia actual:**
- Reglas de ajuste en service:
  - `src/features/orders/orders.service.ts:78-89`
- Persistencia del ajuste en repo (`quantityOnHand increment`):
  - `src/features/orders/orders.repo.ts:296`

### 3) Automatización de estado/uso en rentals

**Antes (2026-02-26):**
- Ya existía el flujo de retorno que ponía item en `AVAILABLE` e incrementaba `usageCount`.

**Ahora (actual):**
- Se mantiene el mismo patrón.

**Evidencia actual:**
- Trigger en service al registrar `actualReturnDate` por primera vez:
  - `src/features/rentals/rentals.service.ts:52-55`
- Update de inventario en repo:
  - `src/features/rentals/rentals.repo.ts:69-70`

### 4) Pagos e inventario

**Antes (2026-02-26):**
- Pagos automatizaban estado de pedido, no inventario.

**Ahora (actual):**
- Se mantiene: pagos pueden cambiar `Order.status`, pero no actualizan directamente `InventoryItem`.

**Evidencia actual:**
- Derivación y update de estado de pedido:
  - `src/features/payments/payments.service.ts:52-60`
  - `src/features/payments/payments.repo.ts:55`

## Delta Funcional (resumen de cambios)

- **Sin cambio**: `RESERVED` no está implementado en dominio activo.
- **Cambio detectado**: ahora hay automatización de `quantityOnHand` en el flujo de `updateOrderStatus`.
- **Sin cambio**: automatización de retorno en rentals sigue vigente.
- **Sin cambio**: pagos no actualizan inventario de forma directa.

## Referencias de Investigación

- Investigación base anterior:  
  `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`
- Investigación actual completa:  
  `thoughts/shared/research/2026-03-03_14-56-30_[general]_inventario-reserved-current-state.md`

## Open Questions

- ¿El ajuste de `quantityOnHand` en `updateOrderStatus` representa la política final esperada para todos los caminos de confirmación/cancelación?
- ¿Se desea mantener explícitamente el dominio sin estado `RESERVED` o está pendiente incorporarlo en otro alcance?
