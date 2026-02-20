# Plan de implementación: Rental asociado a OrderItem (1:1 opcional)

## Objetivo

Refactorizar el módulo de alquiler para que `Rental` se asocie a `OrderItem` en lugar de `Order`, con relación `1:1` opcional, preservando comportamiento funcional y mensajes existentes tanto como sea posible.

---

## Alcance

- Cambiar modelo Prisma de `Rental -> Order` a `Rental -> OrderItem`.
- Adaptar consultas y comandos en:
  - `src/features/rentals/rentals.repo.ts`
  - `src/features/rentals/rentals.service.ts`
  - `src/lib/actions/rentals.ts`
  - `src/features/orders/orders.repo.ts` (cascadas de borrado)
- Ajustar puntos de lectura en páginas de pedidos/alquiler.
- Incluir migración de datos para registros existentes.

---

## Fuera de alcance

- No rediseñar UI ni flujo de negocio de pedidos.
- No introducir nuevos frameworks ni capas.
- No mezclar cambios de producto no relacionados.
- No alterar contratos `ActionResult`.

---

## Estado base (según research)

- `Rental` hoy usa `orderId @unique` y depende de `Order`.
- `OrderItem` no tiene relación con `Rental`.
- Flujo de alquiler consulta/crea por `orderId`.
- Borrado de `Order` elimina `Rental` manualmente en `orders.repo`.

---

## Estrategia general

Ejecución faseada para minimizar ruptura:

1. **Schema + migración de datos (compatibilidad)**
2. **Repositorios (queries Prisma)**
3. **Servicios (orquestación y validaciones existentes)**
4. **Server Actions + rutas consumidoras**
5. **Limpieza final + smoke tests**

Cada fase termina con pausa de verificación antes de continuar.

---

## Phase 1: Prisma schema y migración de datos

## 1.1 Cambios de schema (target)

En `prisma/schema.prisma`:

- En `OrderItem` agregar relación inversa opcional:
  - `rental Rental?`
- En `Rental` reemplazar relación actual:
  - Quitar `orderId` y `order Order`
  - Agregar `orderItemId String? @unique`
  - Agregar `orderItem OrderItem? @relation(fields: [orderItemId], references: [id], onDelete: SetNull)`

Objetivo de cardinalidad:
- `OrderItem (0..1) <-> Rental (0..1)`
- FK opcional en `Rental` para permitir registros sin vínculo inmediato.

## 1.2 Migración SQL de backfill

Crear migración para poblar `Rental.orderItemId` desde datos actuales:

- Para cada `Rental` ligado a `orderId`, seleccionar el `OrderItem` candidato del pedido.
- Regla de selección debe quedar explícita y determinística (por ejemplo: primer `OrderItem` por `createdAt`/`id`).
- Si no existe `OrderItem`, dejar `orderItemId = null`.

## 1.3 Verificación de fase

- [x] `prisma validate` sin errores.
- [x] La migración aplica en local.
- [x] Datos históricos conservan vínculo utilizable (`orderItemId` poblado cuando corresponde).

**Pausa de aprobación al finalizar Phase 1.**

---

## Phase 2: Repositorios (Prisma queries only)

Archivo principal: `src/features/rentals/rentals.repo.ts`

## 2.1 Lecturas

- Reemplazar `findByOrderId(orderId)` por:
  - `findByOrderItemId(orderItemId)`
- Actualizar includes para navegar por:
  - `rental.orderItem`
  - `rental.orderItem.order`
  - `rental.orderItem.product`
  - y mantener includes necesarios de inventario.

## 2.2 Escrituras

- `create` recibe `orderItemId` (opcional en tipo, según schema).
- `findByOrderIdSimple` pasa a equivalente por `orderItemId`.
- Mantener `createCost`, `findCostById`, `deleteCost` sin cambio de comportamiento funcional.

## 2.3 Cascadas de borrado en pedidos

Archivo: `src/features/orders/orders.repo.ts`

- Ajustar `deleteWithCascade` para borrar rentals por `orderItemId` (vía `orderItem` del pedido) en lugar de buscar por `orderId`.
- Mantener estilo de transacción existente.

## 2.4 Verificación de fase

- [x] Todas las queries compilan con tipos Prisma actualizados.
- [x] No se introducen consultas fuera de repositorios.

**Pausa de aprobación al finalizar Phase 2.**

---

## Phase 3: Servicios (orquestación de negocio)

Archivo principal: `src/features/rentals/rentals.service.ts`

## 3.1 Firma de funciones

- Migrar parámetros públicos de `orderId` a `orderItemId` en:
  - `getRental`
  - `createRental`
- Preservar mensajes de error actuales cuando apliquen.

## 3.2 Reglas existentes a preservar

- Unicidad de rental asociado (hoy validada por `findByOrderIdSimple`), movida a `orderItemId`.
- Actualización de inventario en devolución:
  - seguir recorriendo ítems necesarios desde la nueva navegación relacional.

## 3.3 Contratos

- Mantener `ActionResult` sin cambios de forma.
- Mantener respuestas de éxito/error equivalentes.

## 3.4 Verificación de fase

- [x] Servicios compilan y ejecutan flujo create/update/get.
- [x] Sin importaciones de Next.js dentro de services.

**Pausa de aprobación al finalizar Phase 3.**

---

## Phase 4: Server Actions y consumo en páginas

Archivos:
- `src/lib/actions/rentals.ts`
- `src/app/pedidos/[id]/alquiler/page.tsx`
- `src/app/pedidos/[id]/alquiler/rental-manager.tsx`
- consumidores de `getRental`/`createRental`

## 4.1 Actions

- Cambiar payloads de actions para usar `orderItemId`.
- Mantener validación Zod donde ya existe (costos).
- Mantener `revalidatePath` y contrato de retorno.

## 4.2 UI/Pages

- Ajustar lectura de rental en pantalla de alquiler:
  - resolver qué `orderItemId` se usa en contexto de pedido.
- Preservar UX y mensajes actuales.

## 4.3 Verificación de fase

- [x] Pantalla `/pedidos/[id]/alquiler` carga sin errores.
- [x] Crear/editar alquiler y costos sigue funcionando.

**Pausa de aprobación al finalizar Phase 4.**

---

## Phase 5: Limpieza final y cierre

## 5.1 Limpieza

- [x] Eliminar referencias residuales a `Rental.orderId`.
- [x] Confirmar que no queden funciones legacy sin uso.

## 5.2 Smoke tests manuales

- [ ] Listado y detalle de pedidos cargan.
- [ ] Crear alquiler desde flujo vigente.
- [ ] Actualizar devolución (`actualReturnDate`) y validar efecto en inventario.
- [ ] Agregar/eliminar costos de alquiler.
- [ ] Eliminar pedido y validar no quedan rentals huérfanos no esperados.

## 5.3 Verificación técnica

- [x] `npx prisma generate`
- [ ] `npx tsc --noEmit`
- [x] Revisión rápida de lints en archivos tocados.

---

## Riesgos funcionales a vigilar durante implementación

- Selección del `OrderItem` correcto en backfill de datos históricos.
- Flujos que hoy dependen implícitamente de `orderId` en routing `/pedidos/[id]/alquiler`.
- Borrado en cascada de pedido al cambiar pivote relacional.

---

## Orden recomendado de ejecución (resumen)

1. Schema + migración
2. Repo rentals + repo orders
3. Service rentals
4. Actions rentals
5. UI consumo de rental
6. Limpieza + smoke tests

---

## Nota operativa

Este plan está preparado para implementación incremental con checkpoints por fase y aprobación explícita entre fases, en línea con la constitución del proyecto (`CLAUDE.md`) para preservar integridad de datos y evitar cambios de comportamiento no intencionales.
