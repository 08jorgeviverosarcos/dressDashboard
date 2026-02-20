---
date: 2026-02-20T22:02:13Z
researcher: Claude
git_commit: 2b93c383094f5565ec872e113ee38341d75097f4
branch: main
repository: dressDashboard
topic: "Estado actual de OrderItem en detalle de pedido, gestión de alquiler, y patrones para vista detalle de OrderItem con rental inline"
tags: [research, codebase, order-items, rentals, detail-view, navigation-patterns]
status: complete
last_updated: 2026-02-20
last_updated_by: Claude
---

# Research: Vista Detalle de OrderItem con Rental Inline y Refactor de Gestionar Alquiler

**Date**: 2026-02-20T22:02:13Z
**Researcher**: Claude
**Git Commit**: 2b93c383094f5565ec872e113ee38341d75097f4
**Branch**: main
**Repository**: dressDashboard

## Research Question

En la página de pedidos tenemos la tabla items de pedido y aparte "Gestionar Alquiler". Se necesita documentar el estado actual para refactorizar: quitar gestionar alquiler, crear una vista detalle de OrderItem (accesible desde la tabla de items haciendo click), y en esa vista mostrar los datos del orderItem + su rental si existe, con opción de eliminar el orderItem.

## Summary

Actualmente, la página de detalle de pedido (`/pedidos/[id]`) muestra una tabla de items **estática y no clickeable**. La gestión de alquiler vive en una página separada (`/pedidos/[id]/alquiler`) que carga todos los items RENTAL del pedido y permite crear/editar Rental + costos. No existe una vista detalle individual por OrderItem, ni existe un `deleteOrderItem` en ninguna capa (action, service, repo). El codebase tiene un patrón claro de tablas clickeables (`DataTable` + `onRowClick`) y páginas de detalle (`/[entity]/[id]`) que se puede replicar para OrderItems.

## Detailed Findings

### 1. Página de Detalle de Pedido (`src/app/pedidos/[id]/page.tsx`)

- Obtiene el pedido completo con `getOrder(id)` que incluye items con sus relaciones (product, inventoryItem, expenses, rental con costs)
- **Línea 24**: Calcula `hasRental` = true si algún item es `RENTAL`
- **Líneas 48-58**: Botón "Editar" → `/pedidos/${id}/editar`, Botón "Gestionar Alquiler" → `/pedidos/${id}/alquiler` (solo si `hasRental`)
- **Líneas 166-234**: Tabla de items pedido es una tabla HTML estática `<table>` — **las filas NO son clickeables** y **no tienen links**
- Columnas: Tipo (badge), Nombre (con descripción y código producto), Cant., Precio Unit., Descuento, Costo, Subtotal
- También muestra sección de Gastos Vinculados si algún item tiene expenses

### 2. Página Gestionar Alquiler (`src/app/pedidos/[id]/alquiler/page.tsx`)

- **Línea 16**: Lee `itemId` de search params (`?itemId=xxx`)
- **Línea 21**: Filtra items con `itemType === "RENTAL"`
- **Líneas 26-29**: Selecciona item activo por: URL param > primer item con rental existente > primer item rental
- **Línea 31**: Obtiene rental con `getRental(selectedItem.id)` por `orderItemId`
- **Líneas 42-58**: Si hay múltiples items RENTAL, muestra **tabs** (Links) para cambiar entre ellos
- Usa componente `RentalManager` (`rental-manager.tsx`) que:
  - **Sin rental**: Formulario para crear (Return Date + Deposit) → `createRental`
  - **Con rental**: Cards de Depósito y Total Costos, campos editables (Return Date, Actual Return Date, Deposit) → `updateRental`, tabla de costos con agregar/eliminar → `addRentalCost`/`deleteRentalCost`

### 3. Patrón de Tablas Clickeables en el Codebase

**Componente `DataTable`** (`src/components/shared/DataTable.tsx`):
- Acepta prop `onRowClick?: (row: T) => void`
- Cuando está presente, agrega `cursor-pointer` y `onClick` a cada fila
- Columna de acciones con botón trash usa `e.stopPropagation()` para evitar navegar al hacer delete

**Uso en tablas existentes:**
- `src/app/clientes/clients-table.tsx:109` → `onRowClick={(row) => router.push(`/clientes/${row.id}`)}`
- `src/app/pedidos/orders-table.tsx:135` → `onRowClick={(row) => router.push(`/pedidos/${row.id}`)}`
- `src/app/gastos/gastos-table.tsx:119` → `onRowClick={(row) => router.push(`/gastos/${row.id}`)}`

**Nota**: La tabla de items en el detalle de pedido usa `<table>` HTML directo, **no** `DataTable`. Las tablas anidadas en detalle (items dentro de pedido, pedidos dentro de cliente) usan `<table>` con `<Link>` inline, no `DataTable`.

### 4. Patrón de Páginas de Detalle

Todas siguen la misma estructura:
1. Async server component con `params: Promise<{ id: string }>`
2. Fetch con server action → `notFound()` si no existe
3. `PageHeader` con `backHref` al listado padre
4. Botón "Editar" como `<Link>` y opcionalmente botón "Eliminar"
5. Datos en componentes `Card`

**Ejemplos:**
- `src/app/gastos/[id]/page.tsx` — Detalle más simple (solo cards con info)
- `src/app/clientes/[id]/page.tsx` — Con tabla anidada de pedidos + `DeleteClientButton`

### 5. Patrón de Eliminación en Detalle

**Único ejemplo**: `src/app/clientes/[id]/delete-client-button.tsx`
- Client component con `ConfirmDialog`
- On confirm → llama server action `deleteClient(clientId)`
- On success → `toast.success(...)` + `router.push("/clientes")` (navega a lista padre)

### 6. Estado de deleteOrderItem — NO EXISTE

No hay función `deleteOrderItem` en ninguna capa:
- **No** en `src/lib/actions/orders.ts`
- **No** en `src/features/orders/orders.service.ts`
- **No** en `src/features/orders/orders.repo.ts`

Los OrderItems solo se eliminan mediante:
1. **Update de order**: `updateInTransaction` borra TODOS los items y los recrea
2. **Delete de order**: `deleteWithCascade` elimina el order completo con cascade

### 7. Modelo Prisma de OrderItem y Rental

**OrderItem** (`prisma/schema.prisma:93-116`):
- Campos: id, orderId, productId?, inventoryItemId?, itemType (SALE/RENTAL/SERVICE), name, description?, quantity, unitPrice, discountType?, discountValue?, costSource, costAmount, notes?
- Relaciones: order (cascade delete), product?, inventoryItem?, rental? (1:1 opcional), expenses[]

**Rental** (`prisma/schema.prisma:155-165`):
- Campos: id, orderItemId? (unique), returnDate?, actualReturnDate?, deposit, createdAt, updatedAt
- Relación: orderItem? (onDelete: SetNull → al borrar OrderItem, el Rental queda huérfano)
- costs: RentalCost[] (cascade delete)

**Implicación clave**: Al borrar un OrderItem, el Rental asociado NO se borra — queda con `orderItemId: null`. Esto necesita consideración al implementar `deleteOrderItem`.

### 8. Rutas Actuales del Módulo Pedidos

```
/pedidos                          → Lista de pedidos (orders-table.tsx con DataTable)
/pedidos/nuevo                    → Crear pedido (OrderForm)
/pedidos/[id]                     → Detalle pedido (tabla items estática, pagos, gastos)
/pedidos/[id]/editar              → Editar pedido (OrderForm con initialData)
/pedidos/[id]/alquiler            → Gestionar alquiler (RentalManager)
/pedidos/[id]/alquiler?itemId=x   → Gestionar alquiler de item específico
```

## Code References

- `src/app/pedidos/[id]/page.tsx:166-234` — Tabla de items pedido (estática, no clickeable)
- `src/app/pedidos/[id]/page.tsx:53-58` — Botón "Gestionar Alquiler"
- `src/app/pedidos/[id]/alquiler/page.tsx` — Página completa de gestión de alquiler
- `src/app/pedidos/[id]/alquiler/rental-manager.tsx` — Componente de gestión de rental
- `src/components/shared/DataTable.tsx` — Componente reutilizable de tabla con onRowClick
- `src/app/clientes/clients-table.tsx` — Ejemplo de tabla con DataTable + delete + row click
- `src/app/clientes/[id]/page.tsx` — Ejemplo de detalle con botón eliminar
- `src/app/clientes/[id]/delete-client-button.tsx` — Patrón de botón eliminar en detalle
- `src/app/gastos/[id]/page.tsx` — Ejemplo más simple de página detalle
- `src/features/orders/orders.repo.ts:219-225` — deleteWithCascade (borra rental explícitamente antes del order)
- `src/features/orders/orders.repo.ts:110-194` — updateInTransaction (borra y recrea items)
- `prisma/schema.prisma:93-116` — Modelo OrderItem
- `prisma/schema.prisma:155-165` — Modelo Rental (onDelete: SetNull en orderItem)

## Architecture Insights

### Navegación Anidada
El codebase tiene dos niveles de navegación: lista → detalle (ej: `/pedidos` → `/pedidos/[id]`). No hay un tercer nivel tipo `/pedidos/[id]/items/[itemId]` — la página de alquiler (`/pedidos/[id]/alquiler`) es la más cercana pero maneja todos los items RENTAL del pedido, no uno individual.

### Tablas en Detalle vs Tablas en Lista
- **Tablas de lista** (nivel superior): Usan `DataTable` con `onRowClick` → navegan a detalle
- **Tablas anidadas** (dentro de detalle): Usan `<table>` HTML directo, con links inline vía `<Link>` (ej: tabla de pedidos dentro de detalle de cliente)

### Eliminación Individual de Items
No existe patrón de eliminación individual de OrderItem. La estrategia actual es "delete all + re-create" durante update. Para implementar `deleteOrderItem` individual, se debe considerar:
- Qué hacer con el Rental asociado (actualmente onDelete: SetNull → queda huérfano)
- Recalcular totales del pedido
- Revalidar paths afectados

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md` — Estado actual de OrderItem, Product, Rental y flujo de creación
- `thoughts/shared/plans/2026-02-20_18-09-05_[general]_orderitem-type-discount-rental-inline.md` — Plan previo para OrderItem: Tipo, Descuento y Rental Inline
- `thoughts/shared/research/2026-02-19_17-01-20_[general]_rental-orderitem-relacion-1-1-opcional.md` — Investigación sobre relación Rental-OrderItem 1:1 opcional
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md` — Análisis del módulo de Rentals
- `thoughts/shared/research/2026-02-19_00-00-00_[general]_patron-modulos-tabla.md` — Patrón de módulos con tabla, search bar, botón eliminar y navegación a detalle
- `thoughts/shared/plans/2026-02-19_16-00-00_[general]_estandarizacion-patron-modulos-tabla.md` — Estandarización del patrón de módulos con tabla

## Open Questions

1. Al implementar `deleteOrderItem`, ¿se debe también eliminar el Rental asociado o dejarlo huérfano (comportamiento actual con SetNull)?
2. La ruta de la vista detalle de OrderItem: ¿seguiría `/pedidos/[id]/items/[itemId]` o alguna otra convención?
3. ¿La tabla de items en el detalle de pedido debería migrar de `<table>` HTML a usar `DataTable` para tener `onRowClick`, o mantener `<table>` con `<Link>` inline (como hace la tabla de pedidos en detalle de cliente)?
