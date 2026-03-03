# Eliminar RentalCost Implementation Plan

## Overview

Eliminar completamente `rentalCost` del sistema (schema, runtime, UI, validaciones, scripts y tests), asumiendo que la tabla está vacía y no hay necesidad de preservar datos históricos.

## Current State Analysis

Hoy `rentalCost` está modelado en Prisma y conectado al flujo de detalle de `OrderItem` tipo `RENTAL`:
- Modelo/relación: `prisma/schema.prisma` (`Rental.costs`, `model RentalCost`).
- Capa rentals: `src/features/rentals/rentals.repo.ts`, `src/features/rentals/rentals.service.ts`, `src/lib/actions/rentals.ts`.
- UI: `src/app/(dashboard)/pedidos/[id]/items/[itemId]/rental-manager.tsx`.
- Dependencias cruzadas en orders: `src/features/orders/orders.repo.ts`.
- Tipos/tests/scripts: `src/types/index.ts`, `src/lib/validations/rental.ts`, `src/lib/validations/rental.test.ts`, `prisma/seed.ts`, `prisma_import.ts`.

## Desired End State

El proyecto compila y funciona sin ninguna referencia a `RentalCost`, y la UI de alquiler mantiene solo fechas y depósito (sin bloque "Costos del Alquiler").

### Key Discoveries:
- `rental-manager` consume `addRentalCost/deleteRentalCost` y renderiza lista + total de costos (`src/app/(dashboard)/pedidos/[id]/items/[itemId]/rental-manager.tsx`).
- `orders.repo` incluye `rental.costs` y hace soft-delete en cascada vía `tx.rentalCost.updateMany` (`src/features/orders/orders.repo.ts`).
- El cliente Prisma extendido registra `"RentalCost"` en soft-delete models (`src/lib/prisma.ts`).
- Seed/import usan `prisma.rentalCost` (`prisma/seed.ts`, `prisma_import.ts`).

## What We're NOT Doing

- No se preservarán datos de `RentalCost` (tabla vacía, borrado permitido).
- No se migrarán costos de alquiler a otra entidad.
- No se cambiará la lógica de `Rental` fuera de fechas/deposito.
- No se introducen features nuevas en pedidos/rentals.

## Implementation Approach

Ejecutar en fases para evitar roturas de compilación:
1) primero eliminar uso runtime/UI y contratos TS,
2) luego remover modelo en Prisma + migración de drop,
3) finalmente limpiar scripts/datasets/tests y validar build completo.

Este orden reduce errores de tipado intermedios y permite validar regresión funcional de alquiler sin costos.

## Phase 1: Remoción Runtime y UI de Costos

### Overview
Eliminar funcionalidades de alta/baja/listado de costos en capas `actions -> service -> repo -> UI`, manteniendo el resto de `Rental`.

### Changes Required:

#### 1. Server Actions de rentals
**File**: `src/lib/actions/rentals.ts`  
**Changes**:
- Eliminar import de `rentalCostSchema` y `RentalCostFormData`.
- Eliminar `addRentalCost` y `deleteRentalCost`.
- Mantener `getRental`, `createRental`, `updateRental`.

#### 2. Service de rentals
**File**: `src/features/rentals/rentals.service.ts`  
**Changes**:
- Eliminar tipos y funciones `AddRentalCostResult`, `DeleteRentalCostResult`, `addRentalCost`, `deleteRentalCost`.
- Mantener creación/actualización de rental sin cambios de comportamiento.

#### 3. Repo de rentals
**File**: `src/features/rentals/rentals.repo.ts`  
**Changes**:
- Eliminar `include.costs` de `findByOrderItemId`.
- Eliminar `createCost`, `findCostById`, `deleteCost`.
- Mantener operaciones de `Rental` e inventario.

#### 4. UI detalle item RENTAL
**File**: `src/app/(dashboard)/pedidos/[id]/items/[itemId]/rental-manager.tsx`  
**Changes**:
- Quitar bloque "Costos del Alquiler" completo (cards, lista, diálogo y confirmación).
- Quitar imports/estado/event handlers asociados (`addRentalCost`, `deleteRentalCost`, `RENTAL_COST_TYPES`, íconos y componentes de diálogo de costos).
- Ajustar `RentalData` para remover `costs`.

#### 5. Validación/tipos de costo
**File**: `src/lib/validations/rental.ts`  
**Changes**:
- Eliminar `rentalCostSchema` y `RentalCostFormData`.
- Mantener `rentalSchema` y `RentalFormData`.

**File**: `src/lib/validations/rental.test.ts`  
**Changes**:
- Eliminar bloque `describe("rentalCostSchema", ...)`.

### Success Criteria:

#### Automated Verification:
- [x] Typecheck pasa tras remover contratos runtime: `pnpm typecheck`
- [x] Lint pasa en archivos modificados: `pnpm lint`
- [x] Tests de validaciones pasan sin `rentalCostSchema`: `pnpm test`

#### Manual Verification:
- [ ] En `/pedidos/[id]/items/[itemId]` para item RENTAL solo se ven fechas/deposito.
- [ ] No aparece "Costos del Alquiler" ni acciones de agregar/eliminar costo.
- [ ] Crear/actualizar alquiler sigue funcionando.

**Implementation Note**: Al terminar esta fase y verificaciones automáticas, pausar para validación manual antes de continuar.

---

## Phase 2: Ajustes Cross-Module (Orders, Types, Soft-Delete Registry)

### Overview
Eliminar referencias indirectas a `costs` y a `rentalCost` fuera del módulo rentals.

### Changes Required:

#### 1. Repositorio de orders
**File**: `src/features/orders/orders.repo.ts`  
**Changes**:
- Quitar `include: { costs: ... }` dentro de `rental` en `findById` y `findOrderItemById`.
- Quitar pasos de cascade soft-delete de `rentalCost` en:
  - `deleteWithCascade`
  - `deleteOrderItemAndUpdateTotals`
- Mantener soft-delete de `rental` y del resto de entidades.

#### 2. Tipos compartidos Prisma payload
**File**: `src/types/index.ts`  
**Changes**:
- Eliminar `costs` de `OrderWithRelations` en include de `rental`.
- Reemplazar/eliminar `RentalWithCosts` por tipo sin costos (ej. `RentalWithOrderContext`) o eliminar alias si no se usa.

#### 3. Prisma client extension
**File**: `src/lib/prisma.ts`  
**Changes**:
- Eliminar `"RentalCost"` de `SOFT_DELETE_MODELS`.

### Success Criteria:

#### Automated Verification:
- [x] No quedan referencias a `rental.costs` o `rentalCost` en `src/`: `pnpm typecheck`
- [x] Lint sin errores en módulos orders/types/prisma: `pnpm lint`

#### Manual Verification:
- [ ] Vista de pedido (`/pedidos/[id]`) carga correctamente.
- [ ] Eliminación de pedido e item funciona sin errores runtime.
- [ ] No hay regresión visual en tabla de items ni en detalle.

**Implementation Note**: Pausar para validación manual antes de seguir con DB/scripts.

---

## Phase 3: Eliminación del Modelo en Prisma + Migración

### Overview
Eliminar `RentalCost` del schema y aplicar migración de drop de tabla/índices/FK.

### Changes Required:

#### 1. Schema Prisma
**File**: `prisma/schema.prisma`  
**Changes**:
- Eliminar `costs            RentalCost[]` del modelo `Rental`.
- Eliminar completamente `model RentalCost`.

#### 2. Migración nueva de drop
**File**: `prisma/migrations/<timestamp>_drop_rental_cost/migration.sql`  
**Changes**:
- Drop de FK `RentalCost_rentalId_fkey`.
- Drop de índices de `RentalCost`.
- Drop table `RentalCost`.

#### 3. Regeneración del cliente Prisma
**Command**: `pnpm db:migrate`

### Success Criteria:

#### Automated Verification:
- [x] Migración se crea/aplica correctamente: `pnpm db:migrate`
- [x] Prisma Client se genera sin `RentalCost`: `pnpm typecheck`
- [x] Build de Next.js compila: `pnpm build`

#### Manual Verification:
- [ ] App inicia y navega a pedidos/rentals sin errores.
- [ ] Crear/editar item RENTAL y actualizar rental funciona.
- [ ] Eliminar pedido/item no falla por referencias de tabla removida.

**Implementation Note**: Validar en entorno local con DB limpia antes de continuar.

---

## Phase 4: Limpieza de Seeds, Import y Data Files

### Overview
Alinear scripts y datasets con el nuevo schema sin `RentalCost`.

### Changes Required:

#### 1. Seed
**File**: `prisma/seed.ts`, `package.json`  
**Changes**:
- Eliminar el seed por completo y su wiring en scripts/config para evitar ejecución accidental en datos reales.

#### 2. Importador JSON
**File**: `prisma_import.ts`  
**Changes**:
- Eliminar lectura de `rentalCosts.json`.
- Eliminar bloque `tx.rentalCost.createMany(...)`.

#### 3. Dataset
**File**: `data/rentalCosts.json`  
**Changes**:
- Eliminar archivo del set de importación.

#### 4. Migraciones históricas (sin reescritura)
**Files**: `prisma/migrations/20260217163331_init/migration.sql`, `prisma/migrations/20260224134557_add_soft_delete/migration.sql`  
**Changes**:
- No modificar migraciones históricas ya aplicadas; la remoción se hace en nueva migración.

### Success Criteria:

#### Automated Verification:
- [x] Seed removido del proyecto (`prisma/seed.ts` y script/config en `package.json`)
- [ ] Import script compila/ejecuta sin `rentalCosts`: `pnpm tsx prisma_import.ts --dir ./data`
- [ ] Suite global estable: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

Nota: la ejecución del import fue omitida para proteger datos reales; se verificó compilación del proyecto (`pnpm typecheck`) y build (`pnpm build`) sin referencias a `rentalCosts`.

#### Manual Verification:
- [ ] Flujo de carga de datos no espera `rentalCosts.json`.
- [ ] No aparecen errores al correr seed + navegación básica.
- [ ] Vista mobile/desktop de detalle de item RENTAL sigue usable y responsive.

**Implementation Note**: Tras completar esta fase, ejecutar smoke test completo con usuario.

---

## Testing Strategy

### Unit Tests:
- Mantener tests de `rentalSchema`.
- Remover tests del schema eliminado (`rentalCostSchema`).
- Verificar que no queden imports huérfanos en tests.

### Integration Tests:
- Crear pedido con item `RENTAL`, editar item, abrir detalle, actualizar fechas/deposito.
- Eliminar item `RENTAL` y eliminar pedido completo.

### Manual Testing Steps:
1. Crear pedido con item `RENTAL` desde UI.
2. Entrar a detalle del item y confirmar que no existe sección de costos.
3. Actualizar fecha devolución/deposito y verificar persistencia.
4. Eliminar item RENTAL y luego eliminar pedido; confirmar sin errores.
5. Revisar `/pedidos/[id]` y tabla de items en mobile y desktop.

## Performance Considerations

- La remoción reduce joins/includes y consultas asociadas a `rentalCost`.
- Menos estado en `rental-manager` reduce render work del detalle de item.

## Migration Notes

- Se acepta migración destructiva porque la tabla está vacía y no hay ambientes con datos.
- No se requiere backfill ni estrategia de compatibilidad.
- Aplicar migración en branch de trabajo y validar con DB local.

## References

- Original research: `thoughts/shared/research/2026-03-02_17-40-39_[general]_rentalcost-current-state.md`
- Similar refactor context: `thoughts/shared/research/2026-02-20_17-02-13_[general]_orderitem-detail-view-rental-inline-refactor.md`
- Similar cross-layer planning style: `thoughts/shared/plans/2026-02-19_17-07-56_[general]_plan-rental-a-orderitem-1-1-opcional.md`
- Code touchpoints:
  - `prisma/schema.prisma`
  - `src/features/rentals/rentals.repo.ts`
  - `src/features/rentals/rentals.service.ts`
  - `src/lib/actions/rentals.ts`
  - `src/features/orders/orders.repo.ts`
  - `src/app/(dashboard)/pedidos/[id]/items/[itemId]/rental-manager.tsx`
  - `prisma/seed.ts`
  - `prisma_import.ts`
