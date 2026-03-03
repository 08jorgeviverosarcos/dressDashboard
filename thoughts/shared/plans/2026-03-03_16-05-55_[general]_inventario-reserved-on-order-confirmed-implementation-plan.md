# Inventario RESERVED on Order Confirmed Implementation Plan

## Overview

Implementar el estado `RESERVED` para inventario, con trigger principal al pasar un pedido de `QUOTE` a `CONFIRMED`, preservando la arquitectura por capas (`actions -> services -> repos`), el contrato `ActionResult` y los estilos de transacción existentes.

## Current State Analysis

- `InventoryStatus` hoy no incluye `RESERVED`; solo existen `AVAILABLE`, `RENTED`, `SOLD`, `IN_REPAIR`, `RETIRED` en `prisma/schema.prisma`.
- La transición de estado de pedido se procesa en `orders.service.updateOrderStatus`, con validación por `canTransitionTo` y ajuste de `quantityOnHand` para productos `QUANTITY`.
- Los cambios de estado por pago usan `payments.service.createPayment` + `payments.repo.updateOrderStatusAndCreateAuditLog` (tx array), sin pasar por `orders.service.updateOrderStatus`.
- En rentals, al registrar `actualReturnDate` por primera vez, se ejecuta `status: "AVAILABLE"` y `usageCount++` para inventory items vinculados.
- En UI, estados de inventario se muestran/editar en `src/lib/constants/categories.ts` + `src/app/(dashboard)/inventario/inventory-table.tsx`.

### Key Discoveries
- `InventoryStatus` actual sin `RESERVED`: `prisma/schema.prisma`.
- Trigger actual de confirmación/cancelación y ajuste de stock: `src/features/orders/orders.service.ts`.
- Aplicación transaccional de status + auditoría + stock: `src/features/orders/orders.repo.ts`.
- Devolución rental que regresa a `AVAILABLE`: `src/features/rentals/rentals.service.ts` y `src/features/rentals/rentals.repo.ts`.
- Ruta de pagos que puede confirmar pedido sin usar el flujo de `orders.service.updateOrderStatus`: `src/features/payments/payments.service.ts` y `src/features/payments/payments.repo.ts`.

## Desired End State

Después de completar este plan:

1. El dominio soporta `InventoryStatus.RESERVED` (schema + labels UI).
2. Al confirmar pedido (`QUOTE -> CONFIRMED`), los `InventoryItem` de tipo UNIT vinculados al pedido quedan en `RESERVED`.
3. Al cancelar un pedido ya confirmado (o estados posteriores), los `InventoryItem` UNIT vinculados vuelven a `AVAILABLE`.
4. El flujo de devolución de rental sigue retornando a `AVAILABLE` y manteniendo `usageCount++`.
5. El comportamiento aplica tanto si la confirmación ocurre por acción manual como por automatización disparada desde pagos.

Verificación funcional esperada:
- Confirmar pedido desde UI deja unidades asignadas en `RESERVED`.
- Confirmar pedido por pago (cuando corresponde) también deja unidades asignadas en `RESERVED`.
- Cancelar pedido libera unidades asignadas (`AVAILABLE`).
- Marcar devolución real de rental mantiene comportamiento vigente (`AVAILABLE` + `usageCount` incrementado).

## What We're NOT Doing

- No se introduce nuevo framework, API routes ni state manager.
- No se cambia el modelo de soft delete ni su extensión global en `src/lib/prisma.ts`.
- No se redefine la política de `quantityOnHand` más allá de convivir con `RESERVED`.
- No se rediseña el flujo de asignación de `inventoryItemId` en formularios fuera de lo estrictamente necesario para soportar la regla elegida.
- No se altera el contrato de retorno `ActionResult`.

## Implementation Approach

Aplicar cambios incrementales por fases:
- Primero habilitar `RESERVED` en modelo y constantes.
- Luego encapsular la lógica de reserva/liberación en repositorio y orquestarla desde servicios de pedidos.
- Unificar el camino de confirmación de pedido (manual y por pago) para que use una sola orquestación con side effects de inventario.
- Ajustar UI y pruebas para cubrir transiciones nuevas sin modificar semántica de capas.

---

## Phase 1: Extender Dominio de Estado de Inventario

### Overview
Agregar `RESERVED` al dominio y exposición UI, sin activar todavía side effects nuevos.

### Changes Required

#### 1. Schema y tipos Prisma
**File**: `prisma/schema.prisma`  
**Changes**:
- Agregar `RESERVED` al enum `InventoryStatus`.
- Mantener default `AVAILABLE` para `InventoryItem.status`.

#### 2. Labels de estado en UI
**File**: `src/lib/constants/categories.ts`  
**Changes**:
- Incluir `RESERVED: "Reservado"` en `INVENTORY_STATUS_LABELS`.

#### 3. Visualización de estados
**Files**:
- `src/components/shared/StatusBadge.tsx`
- `src/app/(dashboard)/inventario/inventory-table.tsx`  
**Changes**:
- Verificar que rendericen nuevo estado desde labels existentes.
- Mantener mecanismo de edición manual de estado actual.

### Success Criteria

#### Automated Verification
- [x] Prisma genera cliente con enum actualizado sin errores (`pnpm prisma generate`).
- [x] Typecheck pasa con nuevo estado (`pnpm typecheck`).
- [x] Lint pasa en archivos modificados (`pnpm lint`).

#### Manual Verification
- [ ] En tabla de inventario aparece `Reservado` en selector de estado.
- [ ] Badge/etiquetas de inventario muestran correctamente el nuevo estado cuando existe en datos.
- [ ] No hay regresiones visibles en listado de inventario.

**Implementation Note**: Al finalizar esta fase y validar checks automáticos, pausar para confirmación manual antes de pasar a Fase 2.

---

## Phase 2: Reserva y Liberación en Flujo de Pedidos

### Overview
Aplicar transición de `InventoryItem.status` para unidades (`UNIT`) cuando el pedido cambia de estado.

### Changes Required

#### 1. Consultas de items UNIT vinculados al pedido
**File**: `src/features/orders/orders.repo.ts`  
**Changes**:
- Agregar consulta específica para obtener `orderItems` con `inventoryItemId` no nulo y producto `inventoryTracking = "UNIT"`.
- Mantener filtros soft-delete en hasMany/nested donde corresponda.

#### 2. Actualización transaccional de inventario UNIT en cambio de estado
**File**: `src/features/orders/orders.repo.ts`  
**Changes**:
- Extender `updateStatusInTransaction` para aplicar updates de status sobre `InventoryItem` UNIT:
  - `QUOTE -> CONFIRMED`: `AVAILABLE -> RESERVED` (solo items vinculados del pedido).
  - `* -> CANCELLED` (no-QUOTE): liberar a `AVAILABLE` items unitarios vinculados.
- Mantener en la misma transacción:
  - `order.update(status)`
  - `auditLog.create(STATUS_CHANGE)`
  - ajuste `quantityOnHand` existente para `QUANTITY`.

#### 3. Orquestación de reglas en service
**File**: `src/features/orders/orders.service.ts`  
**Changes**:
- Incorporar cálculo de ajustes para UNIT (status updates) junto con ajustes existentes de `quantityOnHand`.
- Mantener validación `canTransitionTo` y mensajes existentes.

### Success Criteria

#### Automated Verification
- [x] Typecheck pasa después de extender firmas de repo/service (`pnpm typecheck`).
- [x] Lint pasa en `orders.service.ts` y `orders.repo.ts` (`pnpm lint`).
- [x] Tests de lógica de estados pasan (`pnpm test -- status` o comando equivalente del proyecto).

#### Manual Verification
- [ ] Confirmar pedido (`QUOTE -> CONFIRMED`) cambia a `RESERVED` los items UNIT asignados.
- [ ] Cancelar pedido ya confirmado libera esos items UNIT a `AVAILABLE`.
- [ ] Ajustes de `quantityOnHand` para productos `QUANTITY` siguen funcionando como antes.
- [ ] Auditoría de cambio de estado sigue registrándose.

**Implementation Note**: Al finalizar esta fase y validaciones automáticas, pausar para confirmación manual antes de Fase 3.

---

## Phase 3: Unificar Camino de Confirmación por Pagos

### Overview
Asegurar que cuando un pago confirme pedido, se ejecuten los mismos side effects de inventario que en cambio manual de estado.

### Changes Required

#### 1. Unificación de orquestación de cambio de estado
**Files**:
- `src/features/payments/payments.service.ts`
- `src/features/payments/payments.repo.ts`
- `src/features/orders/orders.service.ts`  
**Changes**:
- Reusar flujo central de cambio de estado de pedido en vez de update directo de status en repo de pagos.
- Mantener auditoría de pago (`PAYMENT_CREATED`) y control de sobrepago.
- Evitar duplicación de auditoría de `STATUS_CHANGE`.

#### 2. Revalidaciones de vistas
**File**: `src/lib/actions/payments.ts`  
**Changes**:
- Mantener `revalidatePath("/pagos")`, `revalidatePath("/pedidos")`, y detalle de pedido.
- Verificar que refleje cambio de estado y estado de inventario reservado sin refrescos manuales extra.

### Success Criteria

#### Automated Verification
- [x] Typecheck pasa con dependencias cruzadas entre features (`pnpm typecheck`).
- [x] Lint pasa en `payments.*` y `orders.service.ts` (`pnpm lint`).
- [x] Tests de pagos/estado pasan (`pnpm test -- payment status` o comando equivalente).

#### Manual Verification
- [ ] Registrar pago que lleve `QUOTE -> CONFIRMED` reserva unidades (`RESERVED`).
- [ ] Registro de pago mantiene validación de sobrepago y mensajes actuales.
- [ ] Historial/auditoría de pago y de estado se mantienen consistentes.

**Implementation Note**: Al finalizar esta fase y validaciones automáticas, pausar para confirmación manual antes de Fase 4.

---

## Phase 4: Compatibilidad con Rentals y Cobertura de Pruebas

### Overview
Asegurar coherencia de transición final con devoluciones y cubrir escenarios clave.

### Changes Required

#### 1. Verificación de transición en devolución
**Files**:
- `src/features/rentals/rentals.service.ts`
- `src/features/rentals/rentals.repo.ts`  
**Changes**:
- Mantener comportamiento actual: en `actualReturnDate` inicial, `status -> AVAILABLE` y `usageCount++`.
- Confirmar compatibilidad cuando estado previo sea `RESERVED`.

#### 2. Pruebas unitarias/regresión de reglas de estado
**Files** (crear/editar según estructura existente):
- `src/lib/business/status.test.ts`
- tests de services afectados (si existen suites cercanas)  
**Changes**:
- Agregar casos que validen trigger elegido:
  - confirmación manual reserva inventario UNIT.
  - confirmación por pago también reserva.
  - cancelación libera.
  - devolución devuelve a disponible.

### Success Criteria

#### Automated Verification
- [x] Suite de tests pasa con nuevos casos (`pnpm test`).
- [x] Typecheck completo del proyecto (`pnpm typecheck`).
- [x] Lint completo del proyecto (`pnpm lint`).
- [x] Build de Next.js compila (`pnpm build`).

#### Manual Verification
- [ ] Flujo completo: crear pedido con item UNIT asignado -> confirmar -> ver `RESERVED`.
- [ ] Flujo pago: registrar pago que confirme -> ver `RESERVED`.
- [ ] Flujo cancelación: pedido confirmado -> cancelar -> ver `AVAILABLE`.
- [ ] Flujo devolución: rental con devolución real -> ver `AVAILABLE` + incremento de usos.
- [ ] Validación responsive de pantallas tocadas en móvil y desktop.

**Implementation Note**: Al finalizar esta fase y validaciones automáticas, pausar para cierre manual y aprobación final.

---

## Testing Strategy

### Unit Tests
- Reglas de transición de estado de pedido.
- Reglas de derivación de estado por pago sin romper validación de sobrepago.
- Reglas de reserva/liberación de inventario UNIT.
- Compatibilidad de devolución rental con estado `RESERVED`.

### Integration Tests
- `QUOTE -> CONFIRMED` (manual) con side effects de inventario y auditoría.
- `QUOTE -> CONFIRMED` por pago con mismo resultado de inventario.
- Cancelación con liberación de inventario.
- Devolución rental post-reserva con retorno a `AVAILABLE`.

### Manual Testing Steps
1. Crear pedido con item UNIT vinculado a `inventoryItemId`.
2. Confirmar pedido manualmente y verificar estado `RESERVED` en inventario.
3. Crear otro pedido y confirmar vía pago; verificar mismo resultado.
4. Cancelar pedido confirmado y validar liberación a `AVAILABLE`.
5. Registrar devolución real de rental y validar `AVAILABLE` + `usageCount`.

## Performance Considerations

- Mantener updates de inventario dentro de transacciones ya existentes para evitar inconsistencias.
- Evitar consultas extra fuera de transacción cuando sea posible.
- Reusar queries selectivas (campos mínimos) para no ampliar costo de I/O.

## Migration Notes

- Requiere migración Prisma por cambio de enum `InventoryStatus`.
- Para datos existentes no se requiere backfill obligatorio (todos los registros vigentes permanecen con estados existentes).
- Si se desea inicializar `RESERVED` para casos en curso, definir script de datos en fase separada (fuera de este alcance).

## References

- Source research: `thoughts/shared/research/2026-03-03_15-55-05_[general]_inventario-reserved-comparativo-2026-02-26-vs-current.md`
- Expanded research: `thoughts/shared/research/2026-03-03_14-56-30_[general]_inventario-reserved-current-state.md`
- Historical baseline: `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`
- Related implementation context: `thoughts/shared/plans/2026-02-26_19-52-29_[general]_inventario-unidad-vs-cantidad-implementacion.md`
