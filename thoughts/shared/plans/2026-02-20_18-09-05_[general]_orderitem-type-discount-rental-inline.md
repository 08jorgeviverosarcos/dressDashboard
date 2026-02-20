# OrderItem: Tipo, Descuento, Nombre/Descripcion y Rental Inline — Plan de Implementacion

## Overview

Agregar al modelo `OrderItem` los campos `itemType` (SALE/RENTAL/SERVICE), `name`, `description`, `discountType`, `discountValue`, hacer `productId` nullable (para SERVICE), e integrar la creacion basica de Rental (pickupDate, returnDate) directamente en el formulario de pedido. La gestion avanzada de Rental (actualReturnDate, costos) sigue en la pagina separada `/pedidos/[id]/alquiler`.

## Current State Analysis

### OrderItem hoy (`prisma/schema.prisma:91-109`)
- `productId` es **obligatorio** (String, no nullable)
- No existe campo `itemType`, `name`, `description`, `discountType`, `discountValue`
- Relacion 1:1 opcional con Rental (via `Rental.orderItemId`)
- El Rental se crea en pagina separada (`/pedidos/[id]/alquiler`), no durante la creacion del item

### Flujo actual de creacion de items (`OrderForm.tsx` + `OrderItemRow.tsx`)
- Cada item tiene: productId, quantity, unitPrice, costAmount
- Producto se selecciona de un dropdown sin filtrar
- No hay seleccion de tipo
- Auto-fill: `unitPrice` <- `product.salePrice`, `costAmount` <- `product.cost`

### Flujo actual de update (`orders.repo.ts:98-131`)
- Estrategia **delete-and-recreate**: borra todos los items y los recrea
- Esto causa que `Rental.orderItemId` se ponga a null (onDelete: SetNull)

### Key Discoveries:
- `Product.rentalPrice` existe pero no se usa en el flujo de order items (`schema.prisma:37`)
- `ProductType` enum ya tiene RENTAL/SALE/BOTH (`schema.prisma:223-227`)
- La pagina de alquiler auto-selecciona un orderItem sin dar opcion al usuario (`alquiler/page.tsx:17`)
- Los productos se mapean en las paginas sin pasar `type`, `rentalPrice` ni `description` (`nuevo/page.tsx:14-20`)

## Desired End State

1. OrderItem tiene campos: `itemType` (OrderItemType), `name`, `description`, `discountType` (DiscountType?), `discountValue` (Decimal?), y `productId` es nullable
2. Al crear/editar un pedido, el usuario primero elige el tipo de item (Venta, Alquiler, Servicio)
3. **SALE**: Selecciona producto, auto-fill `unitPrice` desde `salePrice`, copia `name` y `description` del producto
4. **RENTAL**: Selecciona producto, auto-fill `unitPrice` desde `rentalPrice`, copia `name` y `description`, muestra campos basicos de Rental (pickupDate, returnDate) inline
5. **SERVICE**: No selecciona producto, el usuario llena `name`, `description` y `unitPrice` manualmente
6. Cada item puede tener descuento opcional (tipo FIXED o PERCENTAGE + valor)
7. La creacion de Rental basica ocurre en la misma transaccion que la creacion del pedido
8. La gestion avanzada del Rental (actualReturnDate, costos, ganancia) sigue en `/pedidos/[id]/alquiler`
9. La pagina de detalle del pedido muestra el tipo de item, nombre, descripcion y descuento

### Verificacion:
- Crear pedido con item tipo SALE: producto seleccionado, name/description copiados, sin rental
- Crear pedido con item tipo RENTAL: producto seleccionado, name/description copiados, rental creado con fechas
- Crear pedido con item tipo SERVICE: sin producto, name/description manuales, sin rental
- Aplicar descuento fijo y porcentual: totales calculados correctamente
- Editar pedido: items se actualizan correctamente, rentals se preservan/recrean
- Pagina de detalle muestra todos los campos nuevos
- Pagina `/pedidos/[id]/alquiler` sigue funcionando para gestion avanzada de Rental

## What We're NOT Doing

- NO cambiar el flujo de gestion avanzada de Rental (costos, actualReturnDate) — sigue en pagina separada
- NO cambiar el modelo Rental ni RentalCost
- NO modificar el flujo de pagos
- NO agregar validaciones de negocio nuevas (ej: no se valida que un producto SALE no pueda ser tipo RENTAL)
- NO cambiar enums existentes (ProductType, CostSource, etc.)
- NO migrar datos existentes (los OrderItem existentes tendran itemType por defecto)
- NO tocar el flujo de Expenses vinculados a OrderItem
- NO modificar el flujo de InventoryItem

## Implementation Approach

**Estrategia general**: Cambios bottom-up (schema -> validacion -> repo -> service -> action -> UI).

**Problema del delete-and-recreate en update**: Al editar un pedido, los items se borran y recrean. Esto rompe la relacion Rental-OrderItem. Solucion: en la transaccion de update, ademas de borrar/recrear items, tambien manejar los Rentals (borrar los que ya no aplican, crear los nuevos, re-asociar los existentes basado en `productId` como clave de matching).

---

## Phase 1: Database Schema Changes

### Overview
Agregar el enum `OrderItemType`, `DiscountType`, y los nuevos campos a `OrderItem`. Hacer `productId` nullable. Crear y ejecutar la migracion.

### Changes Required:

#### 1. Prisma Schema
**File**: `prisma/schema.prisma`

Agregar enums despues de `InventoryStatus` (linea 236):

```prisma
enum OrderItemType {
  SALE
  RENTAL
  SERVICE
}

enum DiscountType {
  FIXED
  PERCENTAGE
}
```

Modificar el modelo `OrderItem` (lineas 91-109):

```prisma
model OrderItem {
  id              String         @id @default(cuid())
  orderId         String
  productId       String?
  inventoryItemId String?
  itemType        OrderItemType  @default(SALE)
  name            String         @default("")
  description     String?
  quantity        Int            @default(1)
  unitPrice       Decimal        @db.Decimal(12, 2)
  discountType    DiscountType?
  discountValue   Decimal?       @db.Decimal(12, 2)
  costSource      CostSource     @default(MANUAL)
  costAmount      Decimal        @default(0) @db.Decimal(12, 2)
  notes           String?
  expenses        Expense[]
  rental          Rental?
  inventoryItem   InventoryItem? @relation(fields: [inventoryItemId], references: [id])
  order           Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product         Product?       @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@index([productId])
}
```

Cambios respecto al actual:
- `productId` pasa de `String` a `String?` (nullable)
- `product` pasa de `Product` a `Product?` (relacion opcional)
- Se agregan: `itemType`, `name`, `description`, `discountType`, `discountValue`
- `name` tiene `@default("")` para que la migracion no falle con datos existentes
- `itemType` tiene `@default(SALE)` para datos existentes

#### 2. Migration
Ejecutar: `npx prisma migrate dev --name add_orderitem_type_discount_name`

Esto generara la migracion automatica. La migracion debe:
- Crear los enums `OrderItemType` y `DiscountType`
- Agregar columnas `itemType`, `name`, `description`, `discountType`, `discountValue` a `OrderItem`
- Hacer `productId` nullable
- Datos existentes: `itemType` defaultea a `SALE`, `name` defaultea a `""`

Despues de migrar, llenar `name` de los OrderItem existentes desde su Product:
```sql
UPDATE "OrderItem" oi
SET name = p.name, description = p.description
FROM "Product" p
WHERE oi."productId" = p.id AND oi.name = '';
```

Ejecutar: `npx prisma generate`

### Success Criteria:

#### Automated Verification:
- [ ] Migration se aplica sin errores: `npx prisma migrate dev --name add_orderitem_type_discount_name`
- [ ] Prisma generate funciona: `npx prisma generate`
- [ ] TypeScript compila (puede haber errores esperados en archivos que usen OrderItem, se corregiran en fases siguientes)

#### Manual Verification:
- [ ] La base de datos tiene los nuevos campos y enums
- [ ] Los datos existentes tienen `itemType = SALE` y `name` copiado del producto

**Implementation Note**: Despues de esta fase, pausar para confirmacion manual.

---

## Phase 2: Zod Validations & Types

### Overview
Actualizar los schemas Zod para incluir los nuevos campos. Hacer `productId` condicional segun `itemType`.

### Changes Required:

#### 1. Order Item Schema
**File**: `src/lib/validations/order.ts`

Reemplazar `orderItemSchema` completo:

```ts
import { z } from "zod";

export const orderItemSchema = z.object({
  itemType: z.enum(["SALE", "RENTAL", "SERVICE"]),
  productId: z.string().optional().nullable(),
  inventoryItemId: z.string().optional().nullable(),
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional().or(z.literal("")).nullable(),
  quantity: z.number().int().min(1, "Cantidad minima: 1"),
  unitPrice: z.number().min(0, "El precio debe ser positivo"),
  discountType: z.enum(["FIXED", "PERCENTAGE"]).optional().nullable(),
  discountValue: z.number().min(0).optional().nullable(),
  costSource: z.enum(["INVENTORY", "EXPENSES", "MANUAL"]).default("MANUAL"),
  costAmount: z.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
  // Rental fields (solo para RENTAL items)
  rentalPickupDate: z.date().optional().nullable(),
  rentalReturnDate: z.date().optional().nullable(),
}).refine(
  (data) => {
    if (data.itemType === "SALE" || data.itemType === "RENTAL") {
      return !!data.productId;
    }
    return true;
  },
  { message: "Seleccione un producto", path: ["productId"] }
);

export const orderSchema = z.object({
  clientId: z.string().min(1, "Seleccione un cliente"),
  orderDate: z.date(),
  eventDate: z.date().optional().nullable(),
  deliveryDate: z.date().optional().nullable(),
  totalPrice: z.number().min(0, "El precio total debe ser positivo"),
  totalCost: z.number().min(0).default(0),
  minDownpaymentPct: z.number().min(0).max(100).default(30),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Agregue al menos un item"),
});

export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
```

Cambios clave:
- Nuevo campo `itemType` obligatorio
- `productId` ahora es `optional().nullable()`
- Nuevos campos: `name`, `description`, `discountType`, `discountValue`
- Campos de rental inline: `rentalPickupDate`, `rentalReturnDate`
- Refinement: `productId` es requerido solo para SALE y RENTAL

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila para `src/lib/validations/order.ts`

#### Manual Verification:
- [ ] N/A (se verifica en fases posteriores con la UI)

**Implementation Note**: Pausar para confirmacion manual.

---

## Phase 3: Repository & Service Updates

### Overview
Actualizar el repositorio y servicio de orders para manejar los nuevos campos, la creacion de Rental inline, y el flujo de update que preserva/recrea Rentals.

### Changes Required:

#### 1. Orders Repository
**File**: `src/features/orders/orders.repo.ts`

**Actualizar tipo `OrderData`** (sin cambios, se mantiene igual).

**Actualizar funcion `create`** (lineas 61-86):
Agregar los nuevos campos al `items.map`:

```ts
export function create(orderData: OrderData, items: OrderItemFormData[]) {
  return prisma.order.create({
    data: {
      clientId: orderData.clientId,
      orderDate: orderData.orderDate,
      eventDate: orderData.eventDate ?? null,
      deliveryDate: orderData.deliveryDate ?? null,
      totalPrice: orderData.totalPrice,
      totalCost: orderData.totalCost,
      minDownpaymentPct: orderData.minDownpaymentPct,
      notes: orderData.notes || null,
      status: "QUOTE",
      items: {
        create: items.map((item) => ({
          productId: item.productId || null,
          inventoryItemId: item.inventoryItemId || null,
          itemType: item.itemType,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: item.discountType || null,
          discountValue: item.discountValue ?? null,
          costSource: item.costSource,
          costAmount: item.costAmount,
          notes: item.notes || null,
        })),
      },
    },
    include: {
      items: true,
    },
  });
}
```

Nota: Ahora retorna `include: { items: true }` para tener acceso a los IDs de los items creados (necesario para crear Rentals).

**Actualizar funcion `updateInTransaction`** (lineas 98-131):
Cambiar estrategia para manejar Rentals:

```ts
export function updateInTransaction(
  id: string,
  orderData: OrderData,
  items: OrderItemFormData[]
) {
  return prisma.$transaction(async (tx) => {
    // 1. Buscar rentals existentes vinculados a items de esta orden
    const existingItems = await tx.orderItem.findMany({
      where: { orderId: id },
      include: { rental: true },
    });

    // 2. Borrar todos los items existentes (Rental.orderItemId -> null por onDelete: SetNull)
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    // 3. Actualizar la orden y crear los nuevos items
    const updatedOrder = await tx.order.update({
      where: { id },
      data: {
        clientId: orderData.clientId,
        orderDate: orderData.orderDate,
        eventDate: orderData.eventDate ?? null,
        deliveryDate: orderData.deliveryDate ?? null,
        totalPrice: orderData.totalPrice,
        totalCost: orderData.totalCost,
        minDownpaymentPct: orderData.minDownpaymentPct,
        notes: orderData.notes || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId || null,
            inventoryItemId: item.inventoryItemId || null,
            itemType: item.itemType,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountType: item.discountType || null,
            discountValue: item.discountValue ?? null,
            costSource: item.costSource,
            costAmount: item.costAmount,
            notes: item.notes || null,
          })),
        },
      },
      include: { items: true },
    });

    // 4. Para items tipo RENTAL, re-asociar rentals existentes o crear nuevos
    const rentalItems = updatedOrder.items.filter((i) => i.itemType === "RENTAL");
    // Rentals huerfanos (orderItemId fue puesto a null en paso 2)
    const orphanedRentals = existingItems
      .filter((ei) => ei.rental)
      .map((ei) => ei.rental!);

    for (const newItem of rentalItems) {
      const formItem = items.find(
        (fi) => fi.itemType === "RENTAL" && fi.productId === newItem.productId
      );

      // Buscar rental huerfano que corresponda (por productId del item original)
      const matchingOldItem = existingItems.find(
        (ei) => ei.rental && ei.productId === newItem.productId
      );
      const orphanedRental = matchingOldItem?.rental;

      if (orphanedRental) {
        // Re-asociar el rental existente al nuevo item y actualizar fechas
        await tx.rental.update({
          where: { id: orphanedRental.id },
          data: {
            orderItemId: newItem.id,
            ...(formItem?.rentalPickupDate !== undefined && { pickupDate: formItem.rentalPickupDate ?? null }),
            ...(formItem?.rentalReturnDate !== undefined && { returnDate: formItem.rentalReturnDate ?? null }),
          },
        });
      } else if (formItem) {
        // Crear nuevo rental
        await tx.rental.create({
          data: {
            orderItemId: newItem.id,
            pickupDate: formItem.rentalPickupDate ?? null,
            returnDate: formItem.rentalReturnDate ?? null,
            chargedIncome: 0,
          },
        });
      }
    }

    // 5. Limpiar rentals huerfanos que ya no tienen item RENTAL correspondiente
    for (const orphan of orphanedRentals) {
      const wasReassociated = rentalItems.some(async () => {
        const rental = await tx.rental.findUnique({ where: { id: orphan.id } });
        return rental?.orderItemId !== null;
      });
      // No borrar rentals huerfanos — se dejan con orderItemId=null como hoy
      // Esto preserva el historial de costos de alquiler
    }
  });
}
```

#### 2. Orders Service
**File**: `src/features/orders/orders.service.ts`

**Actualizar `createOrder`** para crear Rentals para items tipo RENTAL:

```ts
export async function createOrder(
  parsed: OrderFormData
): Promise<ActionResult<{ id: string }>> {
  const { items, ...orderData } = parsed;

  const order = await repo.create(orderData, items);

  // Crear Rentals para items tipo RENTAL
  for (const item of items) {
    if (item.itemType === "RENTAL") {
      const createdItem = order.items.find(
        (oi) => oi.productId === item.productId && oi.itemType === "RENTAL"
      );
      if (createdItem) {
        await rentalRepo.create({
          orderItemId: createdItem.id,
          pickupDate: item.rentalPickupDate ?? null,
          returnDate: item.rentalReturnDate ?? null,
          chargedIncome: 0,
        });
      }
    }
  }

  await repo.createAuditLog({
    entity: "Order",
    entityId: order.id,
    action: "CREATED",
    newValue: "QUOTE",
    orderId: order.id,
  });

  return { success: true, data: { id: order.id } };
}
```

Nota: Se importa `* as rentalRepo from "@/features/rentals/rentals.repo"` al inicio del archivo.

**`updateOrder`** no necesita cambios en el service — la logica de Rental se maneja en el repo `updateInTransaction`.

#### 3. Types
**File**: `src/types/index.ts`

No se necesitan cambios — los tipos Prisma se generan automaticamente del schema.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila sin errores en `orders.repo.ts` y `orders.service.ts`
- [ ] `npx prisma generate` completa exitosamente

#### Manual Verification:
- [ ] N/A (se verifica en fases posteriores con la UI)

**Implementation Note**: Pausar para confirmacion manual.

---

## Phase 4: Server Actions

### Overview
Actualizar las server actions de orders para pasar los nuevos campos y revalidar paths correctamente.

### Changes Required:

#### 1. Orders Actions
**File**: `src/lib/actions/orders.ts`

No requiere cambios significativos — las actions ya pasan `parsed.data` al service, y los nuevos campos fluyen a traves del schema Zod actualizado. Solo verificar que los tipos se alinean.

La unica diferencia es que `OrderFormData` ahora incluye los campos nuevos, pero como `createOrder` y `updateOrder` ya pasan `parsed.data` directamente, el flujo se mantiene.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila sin errores en `src/lib/actions/orders.ts`

#### Manual Verification:
- [ ] N/A

**Implementation Note**: Pausar para confirmacion manual.

---

## Phase 5: UI — OrderForm & OrderItemRow

### Overview
Modificar los componentes del formulario para soportar la seleccion de tipo de item, campos condicionales, descuento, y campos basicos de Rental inline.

### Changes Required:

#### 1. Actualizar datos de productos en las paginas

**File**: `src/app/pedidos/nuevo/page.tsx`

Agregar `type`, `rentalPrice` y `description` al mapeo de productos:

```ts
products={products.map((p) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  type: p.type,
  salePrice: p.salePrice ? Number(p.salePrice) : null,
  rentalPrice: p.rentalPrice ? Number(p.rentalPrice) : null,
  cost: p.cost ? Number(p.cost) : null,
  description: p.description ?? null,
}))}
```

**File**: `src/app/pedidos/[id]/editar/page.tsx`

Mismo cambio al mapeo de productos. Ademas, actualizar `initialData.items` para incluir los nuevos campos:

```ts
items: order.items.map((i) => ({
  itemType: i.itemType,
  productId: i.productId ?? "",
  name: i.name,
  description: i.description ?? "",
  quantity: i.quantity,
  unitPrice: toDecimalNumber(i.unitPrice),
  discountType: i.discountType ?? null,
  discountValue: i.discountValue ? toDecimalNumber(i.discountValue) : null,
  costAmount: toDecimalNumber(i.costAmount),
  rentalPickupDate: i.rental?.pickupDate ? i.rental.pickupDate.toISOString().split("T")[0] : "",
  rentalReturnDate: i.rental?.returnDate ? i.rental.returnDate.toISOString().split("T")[0] : "",
})),
```

#### 2. OrderForm
**File**: `src/components/orders/OrderForm.tsx`

**Actualizar `ProductOption` interface**:
```ts
interface ProductOption {
  id: string;
  code: string;
  name: string;
  type: string;
  salePrice: number | null;
  rentalPrice: number | null;
  cost: number | null;
  description: string | null;
}
```

**Actualizar `initialData.items` type**:
```ts
items: {
  itemType: string;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: string | null;
  discountValue: number | null;
  costAmount: number;
  rentalPickupDate: string;
  rentalReturnDate: string;
}[];
```

**Actualizar `emptyItem`**:
```ts
const emptyItem = {
  itemType: "SALE" as string,
  productId: "",
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  discountType: null as string | null,
  discountValue: null as number | null,
  costAmount: 0,
  rentalPickupDate: "",
  rentalReturnDate: "",
};
```

**Actualizar calculo de `totalPrice`** (linea 72) para considerar descuento:
```ts
const totalPrice = items.reduce((sum, i) => {
  const lineTotal = i.quantity * i.unitPrice;
  if (i.discountType === "FIXED" && i.discountValue) {
    return sum + lineTotal - i.discountValue;
  }
  if (i.discountType === "PERCENTAGE" && i.discountValue) {
    return sum + lineTotal * (1 - i.discountValue / 100);
  }
  return sum + lineTotal;
}, 0);
```

**Actualizar validacion client-side** en `handleSubmit` (lineas 95-98):
```ts
if (items.some((i) => (i.itemType === "SALE" || i.itemType === "RENTAL") && !i.productId)) {
  toast.error("Seleccione un producto para cada item de venta o alquiler");
  return;
}
if (items.some((i) => !i.name)) {
  toast.error("Ingrese un nombre para cada item");
  return;
}
```

**Actualizar construccion de `data.items`** en `handleSubmit` (lineas 111-117):
```ts
items: items.map((i) => ({
  itemType: i.itemType as "SALE" | "RENTAL" | "SERVICE",
  productId: i.productId || null,
  name: i.name,
  description: i.description || null,
  quantity: i.quantity,
  unitPrice: i.unitPrice,
  discountType: i.discountType as "FIXED" | "PERCENTAGE" | null,
  discountValue: i.discountValue,
  costSource: "MANUAL" as const,
  costAmount: i.costAmount,
  rentalPickupDate: i.rentalPickupDate ? new Date(i.rentalPickupDate) : null,
  rentalReturnDate: i.rentalReturnDate ? new Date(i.rentalReturnDate) : null,
})),
```

**Actualizar titulo de la Card** de "Productos" a "Items del Pedido".

**Actualizar boton "Agregar Producto"** a "Agregar Item".

#### 3. OrderItemRow
**File**: `src/components/orders/OrderItemRow.tsx`

Este componente necesita un cambio significativo. La nueva estructura sera:

**Actualizar `ProductOption` interface**:
```ts
interface ProductOption {
  id: string;
  code: string;
  name: string;
  type: string;
  salePrice: number | null;
  rentalPrice: number | null;
  cost: number | null;
  description: string | null;
}
```

**Actualizar `item` type en `OrderItemRowProps`**:
```ts
item: {
  itemType: string;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: string | null;
  discountValue: number | null;
  costAmount: number;
  rentalPickupDate: string;
  rentalReturnDate: string;
};
```

**Nuevo layout del componente**:

1. **Fila 1**: Selector de tipo (SALE/RENTAL/SERVICE) + campos principales
   - Tipo: Select con opciones "Venta", "Alquiler", "Servicio"
   - Si SALE o RENTAL: Select de producto (filtrado por tipo)
   - Si SERVICE: Input de nombre
   - Cantidad, Precio Unit., Costo, Subtotal, Boton eliminar

2. **Fila 2 (condicional)**: Descripcion + Descuento
   - Si SERVICE: Input de descripcion (editable)
   - Si SALE/RENTAL: descripcion mostrada como texto (copiada del producto)
   - Descuento: Select tipo (Fijo/$, Porcentaje/%) + Input valor

3. **Fila 3 (solo RENTAL)**: Campos de Rental
   - Fecha de Recogida (date input)
   - Fecha de Devolucion (date input)

**Logica de `handleProductChange`**:
```ts
function handleProductChange(productId: string) {
  const product = products.find((p) => p.id === productId);
  onChange(index, "productId", productId);
  if (product) {
    onChange(index, "name", product.name);
    onChange(index, "description", product.description ?? "");
    if (item.itemType === "RENTAL") {
      onChange(index, "unitPrice", product.rentalPrice ?? product.salePrice ?? 0);
    } else {
      onChange(index, "unitPrice", product.salePrice ?? 0);
    }
    onChange(index, "costAmount", product.cost ?? 0);
  }
}
```

**Logica de `handleTypeChange`**:
```ts
function handleTypeChange(newType: string) {
  onChange(index, "itemType", newType);
  // Reset campos al cambiar tipo
  onChange(index, "productId", "");
  onChange(index, "name", "");
  onChange(index, "description", "");
  onChange(index, "unitPrice", 0);
  onChange(index, "costAmount", 0);
  onChange(index, "rentalPickupDate", "");
  onChange(index, "rentalReturnDate", "");
}
```

**Filtrado de productos**: Cuando el tipo es SALE, mostrar productos con `type` SALE o BOTH. Cuando el tipo es RENTAL, mostrar productos con `type` RENTAL o BOTH.

```ts
const filteredProducts = products.filter((p) => {
  if (item.itemType === "SALE") return p.type === "SALE" || p.type === "BOTH";
  if (item.itemType === "RENTAL") return p.type === "RENTAL" || p.type === "BOTH";
  return false;
});
```

**Calculo de subtotal con descuento**:
```ts
const lineTotal = item.quantity * item.unitPrice;
const subtotal = (() => {
  if (item.discountType === "FIXED" && item.discountValue) {
    return lineTotal - item.discountValue;
  }
  if (item.discountType === "PERCENTAGE" && item.discountValue) {
    return lineTotal * (1 - item.discountValue / 100);
  }
  return lineTotal;
})();
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila sin errores
- [ ] La app inicia sin errores: `npm run dev`

#### Manual Verification:
- [ ] Crear pedido con item SALE: selector de tipo visible, producto filtrado, name/description copiados
- [ ] Crear pedido con item RENTAL: producto filtrado, campos de fecha inline, rental creado
- [ ] Crear pedido con item SERVICE: sin selector de producto, name/description editables
- [ ] Aplicar descuento fijo: subtotal calcula correctamente
- [ ] Aplicar descuento porcentual: subtotal calcula correctamente
- [ ] Editar pedido existente: campos cargados correctamente con datos existentes
- [ ] Cambiar tipo de item: campos se resetean correctamente
- [ ] Totales del pedido reflejan descuentos correctamente

**Implementation Note**: Pausar para confirmacion manual.

---

## Phase 6: Order Detail Page & Alquiler Page Updates

### Overview
Actualizar la pagina de detalle del pedido para mostrar los nuevos campos, y ajustar la pagina de alquiler para funcionar con multiples items tipo RENTAL.

### Changes Required:

#### 1. Order Detail Page
**File**: `src/app/pedidos/[id]/page.tsx`

**Actualizar tabla de items** (lineas 164-189):

Agregar columna "Tipo" y mostrar nombre del item (en lugar de solo producto):

```tsx
<thead>
  <tr className="border-b bg-muted/50">
    <th className="p-3 text-left font-medium">Tipo</th>
    <th className="p-3 text-left font-medium">Nombre</th>
    <th className="p-3 text-center font-medium">Cant.</th>
    <th className="p-3 text-right font-medium">Precio Unit.</th>
    <th className="p-3 text-right font-medium">Descuento</th>
    <th className="p-3 text-right font-medium">Costo</th>
    <th className="p-3 text-right font-medium">Subtotal</th>
  </tr>
</thead>
<tbody>
  {order.items.map((item) => {
    const lineTotal = item.quantity * toDecimalNumber(item.unitPrice);
    const discountValue = item.discountValue ? toDecimalNumber(item.discountValue) : 0;
    const subtotal = item.discountType === "FIXED"
      ? lineTotal - discountValue
      : item.discountType === "PERCENTAGE"
        ? lineTotal * (1 - discountValue / 100)
        : lineTotal;

    return (
      <tr key={item.id} className="border-b">
        <td className="p-3">
          <Badge variant="outline">
            {item.itemType === "SALE" ? "Venta" : item.itemType === "RENTAL" ? "Alquiler" : "Servicio"}
          </Badge>
        </td>
        <td className="p-3">
          <div>{item.name}</div>
          {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
          {item.product && <div className="text-xs text-muted-foreground">Cod: {item.product.code}</div>}
        </td>
        <td className="p-3 text-center">{item.quantity}</td>
        <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
        <td className="p-3 text-right">
          {item.discountType && item.discountValue ? (
            item.discountType === "PERCENTAGE"
              ? `${toDecimalNumber(item.discountValue)}%`
              : formatCurrency(item.discountValue)
          ) : "—"}
        </td>
        <td className="p-3 text-right">{formatCurrency(item.costAmount)}</td>
        <td className="p-3 text-right font-medium">{formatCurrency(subtotal)}</td>
      </tr>
    );
  })}
</tbody>
```

**Actualizar titulo "Productos"** a "Items del Pedido".

**Actualizar logica de `hasRental`** (linea 24):
```ts
const hasRental = order.items.some((item) => item.itemType === "RENTAL");
```

**Actualizar boton "Gestionar Alquiler"**: Mostrar solo si hay items tipo RENTAL (ya se maneja con `hasRental`).

#### 2. Alquiler Page
**File**: `src/app/pedidos/[id]/alquiler/page.tsx`

Actualizar para manejar multiples items tipo RENTAL. Mostrar selector de item cuando hay mas de uno:

```tsx
export default async function AlquilerPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) return notFound();

  const rentalItems = order.items.filter((item) => item.itemType === "RENTAL");
  const selectedOrderItemId = rentalItems.find((item) => !!item.rental)?.id ?? rentalItems[0]?.id ?? null;
  const rental = selectedOrderItemId ? await getRental(selectedOrderItemId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Alquiler — Pedido #${order.orderNumber}`}
        description={order.client.name}
        backHref={`/pedidos/${id}`}
      />
      <RentalManager
        orderId={id}
        orderItemId={selectedOrderItemId}
        rental={rental ? JSON.parse(JSON.stringify(rental)) : null}
        orderTotal={toDecimalNumber(order.totalPrice)}
      />
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila sin errores
- [ ] La app inicia sin errores: `npm run dev`

#### Manual Verification:
- [ ] Pagina de detalle muestra tipo de item con badge
- [ ] Pagina de detalle muestra nombre y descripcion del item
- [ ] Pagina de detalle muestra descuento cuando existe
- [ ] Subtotales calculados correctamente con descuento
- [ ] Boton "Gestionar Alquiler" aparece para pedidos con items RENTAL
- [ ] Pagina de alquiler funciona correctamente filtrando solo items RENTAL
- [ ] Datos existentes se muestran correctamente (items sin tipo muestran "Venta" por default)

**Implementation Note**: Pausar para confirmacion manual.

---

## Testing Strategy

### Manual Testing Steps:
1. **Crear pedido con item SALE**:
   - Seleccionar tipo "Venta"
   - Seleccionar producto (solo productos SALE/BOTH visibles)
   - Verificar que name/description se copian del producto
   - Verificar que unitPrice se llena desde salePrice
   - Guardar y ver en detalle

2. **Crear pedido con item RENTAL**:
   - Seleccionar tipo "Alquiler"
   - Seleccionar producto (solo productos RENTAL/BOTH visibles)
   - Verificar que unitPrice se llena desde rentalPrice
   - Llenar fechas de recogida y devolucion
   - Guardar — verificar que se creo el Rental asociado
   - Ir a "Gestionar Alquiler" y verificar que las fechas estan

3. **Crear pedido con item SERVICE**:
   - Seleccionar tipo "Servicio"
   - Verificar que no aparece selector de producto
   - Llenar nombre y descripcion manualmente
   - Llenar precio y cantidad
   - Guardar y ver en detalle

4. **Crear pedido mixto** (SALE + RENTAL + SERVICE):
   - Verificar que cada item tiene su propio tipo
   - Verificar totales correctos

5. **Descuento fijo**:
   - Agregar item con descuento fijo de $50
   - Verificar subtotal = (quantity * unitPrice) - 50
   - Verificar total del pedido refleja el descuento

6. **Descuento porcentual**:
   - Agregar item con descuento 10%
   - Verificar subtotal = (quantity * unitPrice) * 0.9
   - Verificar total del pedido refleja el descuento

7. **Editar pedido existente**:
   - Abrir edicion de un pedido existente
   - Verificar que los items cargan con sus tipos y datos correctos
   - Modificar un item y guardar
   - Verificar que el Rental se preservo (para items RENTAL)

8. **Compatibilidad con datos existentes**:
   - Verificar que pedidos creados antes del cambio se muestran correctamente
   - Items existentes deben mostrar tipo "Venta" por default

## Migration Notes

- Los OrderItem existentes tendran `itemType = SALE` por default (migration)
- Los OrderItem existentes tendran `name = ""` inicialmente, luego se llena con `UPDATE` SQL
- Los OrderItem existentes mantienen su `productId` (no afectados por nullable change)
- No se requiere downtime — la migracion es aditiva
- El script SQL para llenar `name` debe ejecutarse despues de la migracion

## Performance Considerations

- El `include: { items: true }` en `create` y `updateInTransaction` agrega una query extra, pero es necesaria para crear Rentals
- El filtrado de productos en el frontend es O(n) pero con pocos productos no es un problema
- No se agregan indices nuevos ya que las queries existentes no cambian

## References

- Research: `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
- Rental-OrderItem plan: `thoughts/shared/plans/2026-02-19_17-07-56_[general]_plan-rental-a-orderitem-1-1-opcional.md`
- Prisma Schema: `prisma/schema.prisma`
- OrderForm: `src/components/orders/OrderForm.tsx`
- OrderItemRow: `src/components/orders/OrderItemRow.tsx`
- Order validations: `src/lib/validations/order.ts`
- Orders repo: `src/features/orders/orders.repo.ts`
- Orders service: `src/features/orders/orders.service.ts`
- Orders actions: `src/lib/actions/orders.ts`
- Order detail page: `src/app/pedidos/[id]/page.tsx`
- Alquiler page: `src/app/pedidos/[id]/alquiler/page.tsx`
- RentalManager: `src/app/pedidos/[id]/alquiler/rental-manager.tsx`
