---
date: 2026-02-18T18:30:00-05:00
researcher: Claude Code
git_commit: 3278280
branch: main
repository: dressDashboard
topic: "Analisis del modulo de Rentals - estado actual, accesibilidad y flujo"
tags: [research, codebase, rentals, orders, inventory, alquiler]
status: complete
last_updated: 2026-02-18
last_updated_by: Claude Code
---

# Research: Modulo de Rentals - Estado actual, accesibilidad y flujo

**Date**: 2026-02-18T18:30:00-05:00
**Researcher**: Claude Code
**Git Commit**: 3278280
**Branch**: main
**Repository**: dressDashboard

## Research Question

Investigar que hace el modulo de rentals, por que no es accesible desde el lado del usuario, que falta para ponerlo a funcionar, como deberia funcionar, cuando deberia poder ver un alquiler.

## Summary

El modulo de rentals **existe y esta implementado** con todas las capas (repo, service, actions, UI). Sin embargo, **no aparece en la navegacion principal** porque los alquileres no son una entidad independiente sino una extension 1:1 de un pedido (Order). La unica forma de llegar a un alquiler es desde el detalle de un pedido (`/pedidos/[id]`), y el boton "Gestionar Alquiler" **solo aparece si el pedido ya tiene un rental asociado**. Esto crea un problema circular: no puedes crear un rental porque no puedes ver el boton para crear uno, a menos que el rental ya exista (como en el seed data).

## Detailed Findings

### 1. Donde vive el modulo de Rentals

El modulo esta distribuido en 21 archivos:

| Capa | Archivos |
|------|----------|
| Schema | `prisma/schema.prisma` (modelos `Rental` linea 148, `RentalCost` linea 161) |
| Validacion | `src/lib/validations/rental.ts` |
| Repositorio | `src/features/rentals/rentals.repo.ts` (10 funciones) |
| Servicio | `src/features/rentals/rentals.service.ts` (5 funciones) |
| Actions | `src/lib/actions/rentals.ts` (5 actions) |
| UI | `src/app/pedidos/[id]/alquiler/page.tsx` + `rental-manager.tsx` |
| Business | `src/lib/business/profit.ts` (`calculateRentalProfit`), `order-type.ts` |
| Constantes | `src/lib/constants/categories.ts` (`RENTAL_COST_TYPES`, labels) |

### 2. Modelo de datos

```
Order (1) -----> (0..1) Rental
                          |
                          |-----> (0..N) RentalCost

InventoryItem.status puede ser RENTED (pero nunca se setea automaticamente)
```

**Rental** (`schema.prisma:148-159`):
- `orderId` (unique, 1:1 con Order)
- `pickupDate`, `returnDate`, `actualReturnDate` (DateTime? nullable)
- `chargedIncome` (Decimal, default 0)
- Relacion has-many con `RentalCost`

**RentalCost** (`schema.prisma:161-170`):
- `type` (String: "Lavado", "Arreglo", "Transporte", "Multa", "Desgaste", "Otros")
- `amount` (Decimal)
- `description` (String?)
- Cascade delete desde Rental

### 3. Navegacion - Por que no es accesible

**Sidebar** (`src/components/layout/Sidebar.tsx:21-30`):

```
/, /pedidos, /clientes, /productos, /categorias, /inventario, /pagos, /gastos
```

**No existe `/alquileres` ni `/rentals`** en la navegacion. Los alquileres se acceden unicamente como sub-pagina de un pedido en `/pedidos/[id]/alquiler`.

**En la pagina de detalle del pedido** (`src/app/pedidos/[id]/page.tsx:42-57`):
- Linea 42: Muestra badge "Alquiler" **solo si `order.rental` existe**
- Lineas 51-57: Muestra boton "Gestionar Alquiler" **solo si `order.rental` existe**

Esto significa que:
1. Si un pedido NO tiene rental, **no hay forma de llegar a la pagina de alquiler** desde la UI
2. La pagina `/pedidos/[id]/alquiler` SI existe y SI maneja la creacion (modo "no rental")
3. Pero el **enlace para llegar a ella solo aparece cuando el rental ya existe**
4. El unico rental que existe actualmente es el del seed data (order 2)

### 4. Como funciona el modulo (flujo completo)

#### Crear un alquiler
1. Usuario navega a `/pedidos/[id]/alquiler`
2. `AlquilerPage` (server component) carga order y rental en paralelo
3. Si no hay rental, `RentalManager` muestra formulario de creacion con:
   - Fecha de recogida
   - Fecha de devolucion
   - Ingreso cobrado (default: total del pedido)
4. Al crear: `service.createRental` verifica duplicado, crea el registro

#### Gestionar un alquiler existente
El `RentalManager` muestra tres secciones:
1. **Resumen**: Ingreso, costos totales, ganancia (ingreso - costos)
2. **Fechas**: Editar pickup, return, actual return, ingreso cobrado
3. **Costos**: Lista de costos con tipo/monto/descripcion, agregar/eliminar

#### Devolver un alquiler (return)
1. Usuario setea "Devolucion Real" (`actualReturnDate`)
2. `service.updateRental` detecta que es la primera vez que se setea `actualReturnDate`
3. Itera todos los items del pedido que tienen `inventoryItem`
4. Para cada uno: `repo.updateInventoryItemOnReturn` → `status = AVAILABLE`, `usageCount += 1`
5. Revalida `/pedidos/${orderId}` y `/inventario`

#### Profit
- `calculateRentalProfit` = `chargedIncome - sum(costs.amount)`
- Independiente del profit del pedido (`totalPrice - totalCost`)

### 5. Que falta para que funcione end-to-end

#### A. Acceso a la pagina de alquiler (critico)
El boton "Gestionar Alquiler" en `/pedidos/[id]/page.tsx` solo aparece si `order.rental` ya existe. No hay forma de crear un rental desde la UI a menos que:
- Se navegue manualmente a `/pedidos/[id]/alquiler` en el browser
- O se cambie la condicion para mostrar el link/boton

**Opcion 1**: Mostrar siempre el boton "Gestionar Alquiler" en todos los pedidos (la pagina ya maneja el estado "sin rental")
**Opcion 2**: Mostrar el boton solo cuando el `ProductType` de algun item sea `RENTAL` o `BOTH`
**Opcion 3**: Crear rental automaticamente al crear un pedido con productos tipo `RENTAL` o `BOTH`

#### B. No hay automatizacion de inventario al crear rental
Cuando se crea un rental, **nada cambia el status del inventoryItem a RENTED**. Solo al devolver (`actualReturnDate`) se cambia a `AVAILABLE`. Esto significa que un item podria estar "alquilado" sin que el inventario lo refleje.

#### C. DerivedOrderType no esta implementado
`order-type.ts` define el tipo `DerivedOrderType = "SALE" | "RENTAL" | "SERVICE" | "MIXED"` pero la funcion `deriveOrderType` existe con logica que mapea `ProductType` a order type. Sin embargo, **no se usa en ningun lugar**. No hay columna `orderType` en el modelo Order ni logica que determine si un pedido es "de alquiler" o "de venta".

#### D. ProductType (RENTAL/SALE/BOTH) no afecta el flujo
El campo `Product.type` con valores `RENTAL`, `SALE`, `BOTH` existe pero es puramente informativo. No determina:
- Si se puede crear un rental para un pedido con ese producto
- Si se muestra el boton de alquiler
- Si se cambia el inventario

#### E. rentalSchema no se usa
`src/lib/validations/rental.ts` exporta `rentalSchema` pero ninguna action lo importa ni lo usa. Solo `rentalCostSchema` se valida en `addRentalCost`.

#### F. No hay strings file
El modulo no tiene `rentals.strings.ts`. Los textos en espanol estan hardcodeados en los componentes y servicios.

### 6. Cuando deberia verse un alquiler

Segun el flujo actual del codigo:

1. **Un rental se puede crear en cualquier pedido** — no hay restriccion por tipo de producto
2. **El rental aparece como badge y boton** en el detalle del pedido una vez creado
3. **La pagina de gestion** (`/pedidos/[id]/alquiler`) funciona tanto para crear como para gestionar
4. **El problema es solo de navegacion**: falta un camino en la UI para llegar a la pagina de creacion

## Code References

- `prisma/schema.prisma:148-170` — Modelos Rental y RentalCost
- `src/features/rentals/rentals.repo.ts:3-90` — 10 funciones de repositorio
- `src/features/rentals/rentals.service.ts:5-95` — 5 funciones de servicio
- `src/lib/actions/rentals.ts:8-62` — 5 server actions
- `src/app/pedidos/[id]/alquiler/page.tsx:12-32` — Pagina de alquiler (server)
- `src/app/pedidos/[id]/alquiler/rental-manager.tsx:46-310` — Componente principal de gestion
- `src/app/pedidos/[id]/page.tsx:42-57` — Condicion de visibilidad del boton alquiler
- `src/components/layout/Sidebar.tsx:21-30` — Navegacion sin enlace a rentals
- `src/lib/business/profit.ts:26-33` — Calculo de profit de alquiler
- `src/lib/business/order-type.ts:1` — DerivedOrderType (no implementado)
- `src/lib/constants/categories.ts:59-66` — RENTAL_COST_TYPES
- `src/lib/validations/rental.ts:3-19` — Schemas de validacion

## Architecture Insights

### Patron actual
Rental es una **extension 1:1 de Order**, no una entidad independiente. Esto significa:
- No hay listado de rentals
- No hay busqueda de rentals
- No hay filtro de "pedidos de alquiler" vs "pedidos de venta"
- Todo se accede desde el contexto de un pedido especifico

### Flujo de inventory
```
Crear Rental → (nada en inventario)
Devolver Rental → inventoryItem.status = AVAILABLE, usageCount++
```
Falta el paso intermedio: `inventoryItem.status = RENTED` al crear o confirmar el rental.

### Relacion ProductType ↔ Rental
Actualmente son conceptos desconectados:
- `ProductType` (RENTAL/SALE/BOTH) es un atributo del producto
- `Rental` es un registro asociado a un pedido
- No hay logica que conecte uno con el otro

## Historical Context (from thoughts/)

No existe directorio `thoughts/` previo. Esta es la primera investigacion documentada.

## Open Questions

1. Deberia mostrarse siempre el boton "Gestionar Alquiler" o solo cuando hay productos tipo RENTAL/BOTH?
2. Deberia crearse el rental automaticamente al crear un pedido con productos de alquiler?
3. Deberia haber una lista de alquileres activos (`/alquileres`) en la navegacion?
4. Deberia el inventario cambiar a RENTED automaticamente al crear/confirmar un rental?
5. Que hace la funcion `deriveOrderType` — deberia usarse para determinar el tipo de pedido y condicionar la UI?
6. Deberia validarse `rentalSchema` en las actions de `createRental`/`updateRental`?
