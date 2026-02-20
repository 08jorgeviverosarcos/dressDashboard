---
date: "2026-02-20T17:56:38Z"
researcher: Claude
git_commit: ee10008c199d93fbcd1d2b08d539d581e8b5f059
branch: main
repository: dressDashboard
topic: "Estado actual de OrderItem, Product, Rental y flujo de creación de items en pedidos"
tags: [research, codebase, orderItem, order, rental, product, order-form, order-item-row]
status: complete
last_updated: "2026-02-20"
last_updated_by: Claude
---

# Research: Estado actual de OrderItem, Product, Rental y flujo de creación de items en pedidos

**Date**: 2026-02-20T17:56:38Z
**Researcher**: Claude
**Git Commit**: ee10008c199d93fbcd1d2b08d539d581e8b5f059
**Branch**: main
**Repository**: dressDashboard

## Research Question

Documentar el estado actual de OrderItem, su relación con Product y Rental, el flujo de creación/edición de order items en el módulo de pedidos, y cómo se manejan actualmente los distintos tipos de items (venta, alquiler, servicio). Contexto: se planea agregar campos `name`, `description`, `discount`, `orderItemType` (enum SALE/RENTAL/SERVICE) a OrderItem, y modificar el flujo UI para seleccionar tipo antes de llenar el item.

## Summary

Actualmente, **OrderItem** es un modelo que siempre requiere un `productId` (campo obligatorio). No existe un campo de tipo de item (SALE/RENTAL/SERVICE), ni campos de `name`, `description` o `discount` en OrderItem. La información del producto (nombre, descripción) solo vive en la tabla `Product`. El flujo de creación de items ocurre inline en `OrderForm.tsx` usando filas `OrderItemRow.tsx`, donde se selecciona un producto de un dropdown que muestra **todos** los productos sin filtrar por tipo. La gestión de alquiler (Rental) ocurre en una página separada (`/pedidos/[id]/alquiler`) después de crear el pedido, no durante la creación del order item.

---

## Detailed Findings

### 1. Modelo OrderItem (Prisma Schema)

**Archivo:** `prisma/schema.prisma:91-109`

```prisma
model OrderItem {
  id              String         @id @default(cuid())
  orderId         String
  productId       String
  inventoryItemId String?
  quantity        Int            @default(1)
  unitPrice       Decimal        @db.Decimal(12, 2)
  costSource      CostSource     @default(MANUAL)
  costAmount      Decimal        @default(0) @db.Decimal(12, 2)
  notes           String?
  expenses        Expense[]
  rental          Rental?
  inventoryItem   InventoryItem? @relation(fields: [inventoryItemId], references: [id])
  order           Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product         Product        @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@index([productId])
}
```

**Campos actuales:**
- `productId` es **obligatorio** (String, no nullable)
- No existe campo `name` ni `description` (se depende completamente de la relación con Product)
- No existe campo `discount`
- No existe campo `orderItemType` ni enum asociado
- `costSource` usa el enum `CostSource` (INVENTORY, EXPENSES, MANUAL)

**Relaciones:**
- `order` → Order (many-to-one, onDelete: Cascade)
- `product` → Product (many-to-one, **obligatorio**)
- `inventoryItem` → InventoryItem (many-to-one, opcional)
- `rental` → Rental (one-to-one, opcional, back-reference)
- `expenses` → Expense[] (one-to-many)

---

### 2. Modelo Product

**Archivo:** `prisma/schema.prisma:29-48`

```prisma
model Product {
  id             String          @id @default(cuid())
  code           String          @unique
  name           String
  type           ProductType
  categoryId     String?
  category       Category?       @relation(fields: [categoryId], references: [id])
  salePrice      Decimal?        @db.Decimal(12, 2)
  rentalPrice    Decimal?        @db.Decimal(12, 2)
  cost           Decimal?        @db.Decimal(12, 2)
  description    String?
  imageUrl       String?
  isActive       Boolean         @default(true)
  ...
}
```

**Enum ProductType** (`schema.prisma:223-227`):
```prisma
enum ProductType {
  RENTAL
  SALE
  BOTH
}
```

Product ya tiene `name`, `description`, y un `type` con valores RENTAL, SALE, BOTH. Tiene tanto `salePrice` como `rentalPrice`.

---

### 3. Modelo Rental

**Archivo:** `prisma/schema.prisma:148-159`

```prisma
model Rental {
  id               String       @id @default(cuid())
  orderItemId      String?      @unique
  pickupDate       DateTime?
  returnDate       DateTime?
  actualReturnDate DateTime?
  chargedIncome    Decimal      @default(0) @db.Decimal(12, 2)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  orderItem        OrderItem?   @relation(fields: [orderItemId], references: [id], onDelete: SetNull)
  costs            RentalCost[]
}
```

- Relación 1:1 opcional con OrderItem (via `orderItemId` unique)
- `onDelete: SetNull` — si se borra el OrderItem, el Rental sobrevive pero pierde su `orderItemId`

---

### 4. Modelo Order

**Archivo:** `prisma/schema.prisma:67-89`

```prisma
model Order {
  id                String      @id @default(cuid())
  orderNumber       Int         @unique @default(autoincrement())
  clientId          String
  status            OrderStatus @default(QUOTE)
  orderDate         DateTime    @default(now())
  eventDate         DateTime?
  deliveryDate      DateTime?
  totalPrice        Decimal     @db.Decimal(12, 2)
  totalCost         Decimal     @default(0) @db.Decimal(12, 2)
  minDownpaymentPct Decimal     @default(30) @db.Decimal(5, 2)
  notes             String?
  ...
  items             OrderItem[]
  payments          Payment[]
}
```

---

### 5. Flujo UI: Creación de Order Items

#### 5.1 OrderForm (componente principal)

**Archivo:** `src/components/orders/OrderForm.tsx`

- **Empty item template** (línea 54): `{ productId: "", quantity: 1, unitPrice: 0, costAmount: 0 }`
- **Estado items** (líneas 68-70): Array de items en memoria, inicializado con un item vacío o los items existentes
- **Agregar item** (líneas 79-81): Botón "Agregar Producto" que agrega un item vacío al array
- **Eliminar item** (líneas 83-86): Solo si hay más de 1 item
- **Cálculo de totales** (líneas 72-73): `totalPrice` y `totalCost` se calculan client-side via `reduce`
- **Submit** (líneas 88-136): Construye `OrderFormData` con `costSource: "MANUAL"` hardcoded para cada item

No existe selección de tipo de item. Todos los items se tratan igual.

#### 5.2 OrderItemRow (fila individual)

**Archivo:** `src/components/orders/OrderItemRow.tsx`

- **Selector de producto** (líneas 48-59): Un `Select` de shadcn/ui que muestra **todos los productos** como `{code} - {name}`
- **Auto-fill** (líneas 33-39): Al seleccionar producto, se auto-llena `unitPrice` desde `product.salePrice` y `costAmount` desde `product.cost`
- **Campos visibles**: Product (Select), Quantity (number), Unit Price (number), Cost (number)
- **Campos NO visibles en UI**: `inventoryItemId`, `costSource`, `notes` — no se exponen en el formulario

No hay filtrado de productos por tipo. No hay opción para seleccionar si es venta, alquiler o servicio.

#### 5.3 Carga de productos en las páginas

**Archivo nuevo:** `src/app/pedidos/nuevo/page.tsx` (líneas 7-21)
**Archivo editar:** `src/app/pedidos/[id]/editar/page.tsx` (líneas 15-34)

Los productos se cargan con `getProducts()` y se mapean a `{ id, code, name, salePrice: Number(...), cost: Number(...) }`. No se pasa el campo `type` ni `rentalPrice` ni `description` al componente.

---

### 6. Flujo UI: Gestión de Rental (separado del OrderForm)

#### 6.1 Página de alquiler

**Archivo:** `src/app/pedidos/[id]/alquiler/page.tsx`

- Se accede desde la vista de detalle del pedido (botón "Gestionar Alquiler")
- Auto-selecciona el `orderItemId`: busca el primer item con rental existente, o el primer item del pedido (línea 17)
- El usuario **no elige** a cuál order item asociar el rental

#### 6.2 RentalManager

**Archivo:** `src/app/pedidos/[id]/alquiler/rental-manager.tsx`

- **Creación**: Campos de pickupDate, returnDate, chargedIncome
- **Edición**: Agrega actualReturnDate y gestión de RentalCost
- `chargedIncome` defaults a `orderTotal` si el usuario pone 0

---

### 7. Validaciones Zod

**OrderItem schema:** `src/lib/validations/order.ts:3-11`
```ts
export const orderItemSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto"),
  inventoryItemId: z.string().optional().nullable(),
  quantity: z.number().int().min(1, "Cantidad minima: 1"),
  unitPrice: z.number().min(0, "El precio debe ser positivo"),
  costSource: z.enum(["INVENTORY", "EXPENSES", "MANUAL"]).default("MANUAL"),
  costAmount: z.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
});
```

- `productId` es **obligatorio** (min 1 char)
- No existe campo `name`, `description`, `discount`, ni `orderItemType`

**Order schema:** `src/lib/validations/order.ts:13-25`
```ts
export const orderSchema = z.object({
  clientId: z.string().min(1, "Seleccione un cliente"),
  orderDate: z.date(),
  eventDate: z.date().optional().nullable(),
  deliveryDate: z.date().optional().nullable(),
  totalPrice: z.number().min(0, "El precio total debe ser positivo"),
  totalCost: z.number().min(0).default(0),
  minDownpaymentPct: z.number().min(0).max(100).default(30),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Agregue al menos un producto"),
});
```

**Rental schema:** `src/lib/validations/rental.ts:3-9`
- Valida `orderItemId`, `pickupDate`, `returnDate`, `actualReturnDate`, `chargedIncome`

---

### 8. Flujo completo: Action → Service → Repo

#### Crear Order
1. `OrderForm.handleSubmit()` → `createOrder(data)` (action)
2. `src/lib/actions/orders.ts:20-29` → Zod validate → `service.createOrder(parsed.data)` → revalidatePath
3. `src/features/orders/orders.service.ts:15-31` → `repo.create(orderData, items)` + audit log
4. `src/features/orders/orders.repo.ts:61-86` → `prisma.order.create()` con nested `items: { create: [...] }`

#### Actualizar Order
1. `OrderForm.handleSubmit()` → `updateOrder(id, data)` (action)
2. `src/lib/actions/orders.ts:31-43` → Zod validate → `service.updateOrder(id, parsed.data)` → revalidatePath
3. `src/features/orders/orders.service.ts:33-42` → `repo.updateInTransaction(id, orderData, items)`
4. `src/features/orders/orders.repo.ts:98-131` → `prisma.$transaction(async (tx) => ...)`: **borra todos los items existentes** y los recrea

**Importante:** El update usa estrategia delete-and-recreate para items. Esto hace que los `OrderItem.id` cambien, afectando la relación con Rental (se setea `orderItemId` a null por `onDelete: SetNull`).

#### Crear Rental
1. `RentalManager.handleCreateRental()` → `createRental(data)` (action)
2. `src/lib/actions/rentals.ts:12-22` → sin validación Zod en create → `service.createRental(data)` → revalidatePath
3. `src/features/rentals/rentals.service.ts:9-28` → verifica que no exista rental para ese orderItem → `repo.create(...)`
4. `src/features/rentals/rentals.repo.ts:40-47` → `prisma.rental.create({ data })`

---

### 9. Enums existentes relevantes

| Enum | Valores | Archivo |
|------|---------|---------|
| `ProductType` | RENTAL, SALE, BOTH | `schema.prisma:223-227` |
| `OrderStatus` | QUOTE, CONFIRMED, IN_PROGRESS, READY, DELIVERED, COMPLETED, CANCELLED | `schema.prisma:190-198` |
| `CostSource` | INVENTORY, EXPENSES, MANUAL | `schema.prisma:217-221` |
| `InventoryStatus` | AVAILABLE, RENTED, SOLD, IN_REPAIR, RETIRED | `schema.prisma:230-236` |

**No existe** un enum `OrderItemType` (SALE, RENTAL, SERVICE).

---

## Code References

- `prisma/schema.prisma:91-109` — Modelo OrderItem
- `prisma/schema.prisma:29-48` — Modelo Product
- `prisma/schema.prisma:67-89` — Modelo Order
- `prisma/schema.prisma:148-159` — Modelo Rental
- `prisma/schema.prisma:223-227` — Enum ProductType
- `src/components/orders/OrderForm.tsx` — Formulario principal de pedidos
- `src/components/orders/OrderItemRow.tsx` — Fila individual de order item
- `src/lib/validations/order.ts` — Schemas Zod de order y orderItem
- `src/lib/validations/rental.ts` — Schema Zod de rental
- `src/lib/actions/orders.ts` — Server actions de orders
- `src/lib/actions/rentals.ts` — Server actions de rentals
- `src/features/orders/orders.service.ts` — Service de orders
- `src/features/orders/orders.repo.ts` — Repository de orders
- `src/features/rentals/rentals.service.ts` — Service de rentals
- `src/features/rentals/rentals.repo.ts` — Repository de rentals
- `src/app/pedidos/nuevo/page.tsx` — Página crear pedido
- `src/app/pedidos/[id]/editar/page.tsx` — Página editar pedido
- `src/app/pedidos/[id]/alquiler/page.tsx` — Página de alquiler
- `src/app/pedidos/[id]/alquiler/rental-manager.tsx` — Componente RentalManager

---

## Architecture Insights

1. **OrderItem siempre requiere Product**: El campo `productId` es obligatorio tanto en el schema Prisma como en la validación Zod. No existe forma actual de crear un order item sin producto.

2. **No hay distinción de tipo de item**: No existe un campo que indique si un order item es venta, alquiler o servicio. El tipo se infiere implícitamente del `ProductType` del producto asociado, pero no se usa programáticamente.

3. **Rental está desacoplado del flujo de creación de items**: La creación del rental ocurre en una página separada, después de crear el pedido. No se captura información de rental durante la creación del order item.

4. **Auto-fill usa salePrice, nunca rentalPrice**: Al seleccionar un producto en `OrderItemRow`, el `unitPrice` se llena desde `product.salePrice`. El campo `rentalPrice` del producto no se utiliza en el flujo de order items.

5. **Los productos no se filtran por tipo**: El dropdown de productos muestra todos los productos, sin importar si son RENTAL, SALE o BOTH.

6. **Update destruye y recrea items**: La estrategia delete-and-recreate en `orders.repo.ts:98-131` significa que los IDs de OrderItem cambian en cada update, rompiendo la relación con Rental (que queda con `orderItemId = null`).

7. **No existe descuento**: No hay campo `discount` en OrderItem ni en la UI.

8. **Datos de producto no se copian al item**: El nombre y descripción del producto no se almacenan en OrderItem. Si el producto cambia, los pedidos históricos reflejarían los datos actualizados del producto, no los del momento de la creación.

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-19_17-01-20_[general]_rental-orderitem-relacion-1-1-opcional.md` — Documenta la relación 1:1 opcional entre Rental y OrderItem
- `thoughts/shared/plans/2026-02-19_17-07-56_[general]_plan-rental-a-orderitem-1-1-opcional.md` — Plan de implementación para asociar Rental a OrderItem (ya implementado)
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md` — Análisis del módulo de rentals
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md` — Migración de Expense a OrderItem

---

## Related Research

- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`
- `thoughts/shared/research/2026-02-19_17-01-20_[general]_rental-orderitem-relacion-1-1-opcional.md`

---

## Open Questions

1. **Estrategia de update delete-and-recreate**: Al agregar Rental inline con el OrderItem, la estrategia actual de borrar y recrear items en update (`orders.repo.ts:104`) destruiría la asociación Rental-OrderItem. Esto necesitará consideración al implementar los cambios propuestos.

2. **ProductType vs OrderItemType**: El enum `ProductType` (RENTAL, SALE, BOTH) ya existe en Product. El nuevo `OrderItemType` (SALE, RENTAL, SERVICE) tendría overlap parcial pero agrega SERVICE que no existe en ProductType.

3. **rentalPrice no utilizado**: El campo `Product.rentalPrice` existe en el schema pero no se usa en el flujo de order items. Al implementar la selección por tipo, se podría usar `rentalPrice` para items tipo RENTAL.
