---
date: 2026-02-26T13:05:41-0500
researcher: Claude Code (claude-opus-4-6)
git_commit: 7d96b0fe962983c0b912f7bfeeff6b11ca678d63
branch: main
repository: dressDashboard
topic: "Inventario por unidad vs por cantidad: estado actual del sistema"
tags: [research, codebase, inventory, product, order, rental, inventoryTracking, assetCode]
status: complete
last_updated: 2026-02-26
last_updated_by: Claude Code (claude-opus-4-6)
---

# Research: Inventario por unidad vs por cantidad -- Estado actual del sistema

**Date**: 2026-02-26T13:05:41-0500
**Researcher**: Claude Code (claude-opus-4-6)
**Git Commit**: `7d96b0fe962983c0b912f7bfeeff6b11ca678d63`
**Branch**: `main`
**Repository**: `dressDashboard`

## Research Question

Documentar el estado actual del sistema en relacion a: Product, InventoryItem, OrderItem, Rental, y como interactuan -- como contexto para la decision de agregar `inventoryTracking` (UNIT vs QUANTITY) a Product y `assetCode` a InventoryItem.

## Summary

El sistema actual trata **todos** los productos de la misma forma a nivel de inventario. No existe distincion entre productos que se rastrean por unidad fisica (vestidos) y productos que se rastrean por cantidad (accesorios). Los hallazgos clave son:

1. **Product.code** es el unico identificador humano visible del producto (ej: `VES-001`). Se auto-genera a partir del prefijo de la categoria. No existe campo `assetCode` ni `inventoryTracking` en ningun modelo.

2. **InventoryItem** siempre pertenece a un Product y tiene `quantityOnHand` (default 1) y `status` (AVAILABLE/RENTED/SOLD/IN_REPAIR/RETIRED). El campo `quantityOnHand` **nunca se decrementa automaticamente** por ninguna operacion de negocio.

3. **OrderItem.inventoryItemId** existe en el esquema pero **nunca se asigna desde la UI**. Los formularios de pedidos no incluyen selector de InventoryItem. El campo siempre es `null` en la practica.

4. **La relacion Rental -> InventoryItem** es indirecta: Rental -> OrderItem -> InventoryItem. La unica automatizacion existente es al devolver un alquiler (set `actualReturnDate`), donde se marca el inventario como `AVAILABLE` y se incrementa `usageCount`.

5. **No existe automatizacion** para marcar inventario como `RENTED` al crear un alquiler, ni como `SOLD` al crear una venta.

---

## Detailed Findings

### 1. Modelo Product -- Estado actual

**Schema** (`prisma/schema.prisma:35-56`):

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | String (cuid) | PK |
| `code` | String @unique | Codigo visible (ej: VES-001) |
| `name` | String | Nombre del producto |
| `type` | ProductType | RENTAL / SALE / BOTH |
| `categoryId` | String? | FK a Category (opcional) |
| `salePrice` | Decimal? | Precio de venta |
| `rentalPrice` | Decimal? | Precio de alquiler |
| `cost` | Decimal? | Costo del producto |
| `description` | String? | Descripcion |
| `imageUrl` | String? | URL de imagen (no expuesta en UI) |
| `isActive` | Boolean | Default true |

**Relaciones**:
- `category Category?` -- opcional, belongsTo
- `inventoryItems InventoryItem[]` -- hasMany
- `orderItems OrderItem[]` -- hasMany

**No existe**: `inventoryTracking`, `assetCode`, ni ningun campo que distinga el tipo de seguimiento de inventario.

**Auto-codigo**: El servicio (`products.service.ts:22-48`) genera codigos tipo `{CATEGORY_CODE}-{NNN}` (ej: `VES-004`). Usa regex para encontrar el mayor consecutivo existente.

**Donde aparece Product.code en la UI** (12+ ubicaciones):
- Tabla de productos (`products-table.tsx:40`)
- Detalle de producto (`productos/[id]/page.tsx:26`)
- Tabla de inventario (`inventory-table.tsx:82`)
- Detalle de inventario (`inventario/[id]/page.tsx:22,37`)
- Selector de producto en formulario de inventario (`inventory-item-form.tsx:51,113`)
- Tabla de items de pedido (`order-items-table.tsx:77`) -- como `Cod: {product.code}`
- Selector de producto en OrderItemRow (`OrderItemRow.tsx:104,151`)
- Formulario de edicion de item (`order-item-edit-form.tsx:147,189`)
- Detalle de item de pedido (`items/[itemId]/page.tsx:87`)
- Detalle de categoria (`categorias/[id]/page.tsx:74`)
- Selector de items en gastos (`OrderItemSelectorModal.tsx:93`)
- Busqueda en repo (`products.repo.ts:11-15`)

### 2. Modelo InventoryItem -- Estado actual

**Schema** (`prisma/schema.prisma:58-75`):

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | String (cuid) | PK |
| `productId` | String | FK a Product (requerido) |
| `quantityOnHand` | Int @default(1) | Cantidad disponible |
| `status` | InventoryStatus @default(AVAILABLE) | Estado actual |
| `usageCount` | Int @default(0) | Veces usado (solo se incrementa en devolucion de alquiler) |
| `acquiredAt` | DateTime | Fecha de adquisicion |
| `notes` | String? | Notas |

**No existe**: `assetCode`, ni ningun campo que identifique la unidad fisica mas alla del `id` (cuid) y la relacion con `product.code`.

**InventoryStatus enum** (`schema.prisma:259-265`): `AVAILABLE | RENTED | SOLD | IN_REPAIR | RETIRED`

**Labels en UI** (`categories.ts:101-107`):
```
AVAILABLE: "Disponible"
RENTED: "Alquilado"
SOLD: "Vendido"
IN_REPAIR: "En reparacion"
RETIRED: "Retirado"
```

**Comportamiento de `quantityOnHand`**:
- Se establece al crear (default 1 en servicio y UI)
- Editable via `updateInventoryItem` (action/service/repo existen)
- **Nunca se decrementa/incrementa automaticamente** por pedidos, alquileres o devoluciones
- Es puramente informativo en la practica actual

**Comportamiento de `status`**:
- Cambio manual: dropdown en tabla de inventario -> `updateInventoryStatus`
- Cambio automatico (unico): al devolver alquiler (`rentals.service.ts:53-58`) -> set `AVAILABLE` + `usageCount++`
- `RENTED` **nunca se establece automaticamente** -- solo manualmente
- `SOLD` **nunca se establece automaticamente** -- solo manualmente
- No existe maquina de estados: cualquier status puede transicionar a cualquier otro

**Creacion de inventario** (UI en `/inventario/nuevo`):
- Campos del formulario: producto (selector modal), cantidad (default 1), notas
- No expone selector de status al crear (siempre AVAILABLE)
- Crea **un solo InventoryItem** por submission del formulario

**Softdelete**: El repo usa **hard delete** (`prisma.inventoryItem.delete`) en lugar de soft delete, y usa **findUnique** en lugar de findFirst. Ambos violan las convenciones del proyecto.

### 3. Modelo OrderItem -- Relacion con Product e InventoryItem

**Schema** (`prisma/schema.prisma:105-130`):

| Campo relevante | Tipo | Descripcion |
|---|---|---|
| `productId` | String? | FK a Product (opcional -- null para SERVICE) |
| `inventoryItemId` | String? | FK a InventoryItem (opcional) |
| `itemType` | OrderItemType | SALE / RENTAL / SERVICE |
| `quantity` | Int @default(1) | Cantidad |
| `unitPrice` | Decimal | Precio unitario |

**Como se asigna `productId`**:
- En formularios de pedido (`OrderForm`, `OrderItemRow`), el usuario selecciona un Product via `EntitySelectorModal`
- Obligatorio para SALE y RENTAL (validado por refinamiento Zod en `order.ts:18-23`)
- Opcional para SERVICE
- Al seleccionar producto, se auto-llenan: `name`, `description`, `unitPrice` (rentalPrice o salePrice segun tipo), `costAmount`

**Como se asigna `inventoryItemId`** (CRITICO):
- El campo esta en el esquema Zod (`order.ts:6`): `inventoryItemId: z.string().optional().nullable()`
- El repo lo persiste al crear/actualizar items
- **PERO**: ningun formulario de UI expone un selector de InventoryItem
- `OrderForm` (crear/editar pedido completo): no incluye `inventoryItemId` en el payload -> siempre `null`
- `OrderItemEditForm` (editar item individual): preserva `initialValues.inventoryItemId` pero no permite cambiarlo
- **En la practica, `inventoryItemId` es siempre `null`** a menos que se asigne por otro medio (seed, DB directa)

### 4. Modelo Rental -- Relacion con OrderItem e InventoryItem

**Schema** (`prisma/schema.prisma:173-186`):

| Campo | Tipo | Descripcion |
|---|---|---|
| `orderItemId` | String? @unique | FK a OrderItem (1:1 opcional) |
| `returnDate` | DateTime? | Fecha esperada de devolucion |
| `actualReturnDate` | DateTime? | Fecha real de devolucion |
| `deposit` | Decimal @default(0) | Deposito |

**Cadena de relacion**: `Rental -> OrderItem -> InventoryItem` (y `OrderItem -> Product`)

**No existe un status explicito de Rental**. El estado se infiere:
- `rental == null` -> No hay alquiler
- `rental.actualReturnDate == null` -> Alquiler activo
- `rental.actualReturnDate != null` -> Alquiler devuelto

**Creacion de Rental (dos caminos)**:

1. **Automatica al crear pedido** (`orders.service.ts:25-38`): Para cada item con `itemType === "RENTAL"`, se crea un Rental con `orderItemId`, `returnDate`, y `deposit`. No se modifica el inventario.

2. **Manual desde RentalManager** (`rental-manager.tsx:62`): El usuario crea un Rental para un OrderItem existente. Tampoco modifica el inventario.

**Devolucion de alquiler** (`rentals.service.ts:53-58`):
- Se activa cuando `actualReturnDate` se establece por primera vez
- Itera sobre **TODOS** los items del pedido (no solo el item de alquiler)
- Para cada item con `inventoryItem`, llama `repo.updateInventoryItemOnReturn`
- Resultado: `status = "AVAILABLE"`, `usageCount++`

### 5. Flujo completo: Crear pedido con alquiler (hoy)

```
1. Usuario en /pedidos/nuevo selecciona productos via EntitySelectorModal
2. Para items RENTAL: selecciona Product (no InventoryItem), llena fecha devolucion y deposito
3. OrderForm construye items SIN inventoryItemId (siempre null)
4. Server action valida con Zod -> service.createOrder
5. Repo crea Order + OrderItems (inventoryItemId: null)
6. Service itera items RENTAL -> crea Rental para cada uno
7. NO se modifica ningun InventoryItem (no hay vinculacion)
8. El usuario debe ir manualmente a inventario y cambiar status a RENTED si lo desea
```

### 6. Flujo completo: Devolucion de alquiler (hoy)

```
1. Usuario en /pedidos/[id]/items/[itemId] -> RentalManager
2. Establece actualReturnDate por primera vez
3. Service detecta primera devolucion (data.actualReturnDate && !rental.actualReturnDate)
4. Itera ALL items del Order con inventoryItem
5. Para cada uno: status = AVAILABLE, usageCount++
6. PERO: como inventoryItemId es generalmente null, este loop no hace nada en la practica
```

### 7. Modelo Category -- Relacion con Product.code

**Schema** (`prisma/schema.prisma:23-33`):

| Campo | Tipo | Descripcion |
|---|---|---|
| `code` | String @unique | Codigo de categoria (ej: VES, ACC) |
| `name` | String | Nombre |

**Auto-generacion de Product.code**:
- Service (`products.service.ts:22-48`)
- Busca el maximo consecutivo existente con regex `^{prefix}-(\d+)$`
- Genera `{prefix}-{NNN}` (zero-padded a 3 digitos)
- Ejemplo: Category.code = "VES" -> Product.code = "VES-004"

### 8. Resumen de campos NO existentes (relevantes para la decision)

| Campo propuesto | Modelo | Estado actual |
|---|---|---|
| `inventoryTracking` (UNIT/QUANTITY) | Product | NO existe |
| `assetCode` | InventoryItem | NO existe |
| Selector de InventoryItem en pedidos | OrderItem UI | NO existe (inventoryItemId siempre null) |
| Automatizacion status RENTED | InventoryItem | NO existe |
| Automatizacion status SOLD | InventoryItem | NO existe |
| Decremento automatico de quantityOnHand | InventoryItem | NO existe |

---

## Code References

### Schema
- `prisma/schema.prisma:35-56` -- Product model
- `prisma/schema.prisma:58-75` -- InventoryItem model
- `prisma/schema.prisma:105-130` -- OrderItem model
- `prisma/schema.prisma:173-186` -- Rental model
- `prisma/schema.prisma:252-256` -- ProductType enum
- `prisma/schema.prisma:259-265` -- InventoryStatus enum
- `prisma/schema.prisma:272-276` -- OrderItemType enum

### Inventory layer
- `src/lib/actions/inventory.ts` -- Server actions (6 funciones, sin Zod validation)
- `src/features/inventory/inventory.service.ts` -- Service (create defaults, delete guard, no status machine)
- `src/features/inventory/inventory.repo.ts` -- Repository (hard delete en deleteById, findUnique en findById)
- `src/app/inventario/inventory-table.tsx` -- Tabla con dropdown de status manual
- `src/app/inventario/nuevo/inventory-item-form.tsx` -- Formulario creacion (producto + cantidad + notas)
- `src/app/inventario/[id]/page.tsx` -- Detalle (read-only)

### Product layer
- `src/lib/actions/products.ts` -- Server actions con Zod validation
- `src/features/products/products.service.ts` -- Service (unicidad de code, auto-code generation)
- `src/features/products/products.repo.ts` -- Repository (findAll filtra isActive:true)
- `src/lib/validations/product.ts` -- Zod schema
- `src/app/productos/product-form.tsx` -- Formulario completo con auto-code
- `src/features/products/components/ProductQuickForm.tsx` -- Quick form en modales

### Order layer
- `src/lib/actions/orders.ts` -- Server actions con Zod validation
- `src/features/orders/orders.service.ts` -- Service (create/update/delete orders, updateOrderItem)
- `src/features/orders/orders.repo.ts` -- Repository (create, updateInTransaction, deleteWithCascade)
- `src/lib/validations/order.ts` -- Zod schemas (orderSchema, orderItemSchema con inventoryItemId)
- `src/components/orders/OrderForm.tsx` -- Formulario principal (NO incluye inventoryItemId)
- `src/components/orders/OrderItemRow.tsx` -- Fila de item (selecciona Product, no InventoryItem)
- `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx` -- Edicion individual (preserva inventoryItemId sin selector)

### Rental layer
- `src/lib/actions/rentals.ts` -- Server actions (solo addRentalCost usa Zod)
- `src/features/rentals/rentals.service.ts` -- Service (create, update con return logic, costs)
- `src/features/rentals/rentals.repo.ts` -- Repository (updateInventoryItemOnReturn es la unica automatizacion)
- `src/app/pedidos/[id]/items/[itemId]/rental-manager.tsx` -- UI de gestion de alquiler

### Constants
- `src/lib/constants/categories.ts:94-98` -- PRODUCT_TYPE_LABELS
- `src/lib/constants/categories.ts:101-107` -- INVENTORY_STATUS_LABELS
- `src/lib/constants/categories.ts:58-65` -- RENTAL_COST_TYPES

---

## Architecture Insights

### Patron actual de inventario
- **1 Product -> N InventoryItems**: un producto puede tener multiples items de inventario
- **Todos los InventoryItems se tratan igual**: no hay distincion entre "unidad rastreable" (vestido) y "stock por cantidad" (accesorio)
- **quantityOnHand = 1 por defecto**: el sistema ya tiende a tratar cada InventoryItem como unidad, pero el campo permite valores > 1

### Patron de identificacion actual
- **Product.code** (unico, auto-generado): VES-001, ACC-003
- **InventoryItem.id** (cuid, no human-readable): identificador interno
- **No existe identificador de unidad fisica visible**: si hay 5 InventoryItems del mismo producto, solo se distinguen por su `id` (cuid) en la UI

### Patron de vinculacion pedido-inventario
- El esquema soporta `OrderItem.inventoryItemId` pero la UI no lo expone
- Esto significa que actualmente no hay forma de saber cual unidad especifica de inventario se asocio a un pedido

### Patron de automatizacion
- Unica automatizacion: `actualReturnDate` -> `status = AVAILABLE` + `usageCount++`
- Pattern: event-driven en service layer (un evento de negocio en un dominio dispara actualizacion en otro)

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md` -- Investigacion directa sobre automatizacion de cantidad/estado de inventario. Confirma que quantityOnHand no tiene automatizaciones y que solo la devolucion de alquiler automatiza el status. Incluye follow-up sobre inventoryItemId nunca asignado desde UI.

- `thoughts/shared/research/2026-02-24_15-47-32_[general]_product-code-autofill-by-category-current-state.md` -- Documenta el sistema de auto-generacion de Product.code por prefijo de categoria.

- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md` -- Documenta OrderItem, Product, Rental y flujo de creacion de items.

- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md` -- Confirma que RENTED nunca se establece automaticamente.

- `thoughts/shared/research/2026-02-25_13-39-25_[general]_pedidos-estado-automatizaciones-current-state.md` -- Automatizaciones de Order.status (no tocan inventario).

- `thoughts/shared/research/2026-02-24_22-00-00_general_entity-selector-modal-pattern-spec.md` -- EntitySelectorModal usado para seleccion de Product (seria relevante si se agrega selector de InventoryItem).

---

## Related Research

- `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`
- `thoughts/shared/research/2026-02-24_15-47-32_[general]_product-code-autofill-by-category-current-state.md`
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`
- `thoughts/shared/research/2026-02-25_13-39-25_[general]_pedidos-estado-automatizaciones-current-state.md`

---

## Open Questions

1. Al agregar `inventoryTracking = UNIT` y crear 5 InventoryItems para un producto, el formulario de inventario actual solo crea 1 item por submission. Se necesitaria un flujo de "agregar N unidades" o un campo de cantidad que genere N registros?

2. Para productos con `inventoryTracking = QUANTITY`, el InventoryItem actual tiene `quantityOnHand`. Se mantendria un solo InventoryItem por producto (con quantityOnHand > 1)? O se eliminaria la necesidad de InventoryItem para estos productos?

3. El `assetCode` auto-generado (VES-001-01, VES-001-02): se genera al crear el InventoryItem? Se puede editar despues? Que pasa si se elimina un item intermedio (VES-001-02 de 5)?

4. Al agregar selector de InventoryItem en OrderItem para UNIT products: se usaria EntitySelectorModal filtrando por productId y status=AVAILABLE? Se mostraria el assetCode como columna principal?

5. Para el flujo de pedidos: en QUANTITY, al crear un OrderItem con quantity=3, se debe decrementar automaticamente `quantityOnHand -= 3` en el InventoryItem del producto? En que punto del ciclo (al crear, confirmar, entregar)?

6. El update de pedido completo usa estrategia "delete-all + recreate-all" para items. Con inventoryItemId asignado, esta estrategia perderia la vinculacion con inventario al recrear. Se necesitaria cambiar a per-item diff, o preservar la vinculacion de alguna forma?
