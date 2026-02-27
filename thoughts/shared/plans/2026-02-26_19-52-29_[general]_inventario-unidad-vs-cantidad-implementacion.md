# Inventario: UNIT vs QUANTITY — Plan de Implementación

## Overview

Implementar el sistema de seguimiento dual de inventario: `UNIT` para unidades físicas rastreables (vestidos) y `QUANTITY` para accesorios gestionados por cantidad. Incluye el campo `assetCode` para identificar unidades físicas, un selector de `InventoryItem` en pedidos para productos UNIT, estrategia de diff por item en edición de pedidos, y automatización de stock para QUANTITY.

---

## Current State Analysis

- **`Product`**: tiene `code @unique`, `type ProductType`. Sin campo `inventoryTracking`.
- **`InventoryItem`**: tiene `quantityOnHand Int @default(1)`, `status`, `usageCount`. Sin `assetCode`.
- **`OrderItem.inventoryItemId`**: existe en schema y en repos, pero **nunca se asigna desde UI** (siempre `null`).
- **`quantityOnHand`**: nunca se decrementa/incrementa automáticamente (solo manual y retorno de rental).
- **`updateInTransaction`** (orders.repo.ts:113): estrategia delete-all + recreate-all. Destruiría `inventoryItemId` si se asignara.
- **`updateStatusInTransaction`** (orders.repo.ts:210): **batch transaction** `prisma.$transaction([...])`.
- **Bugs conocidos en `inventory.repo.ts`**:
  - `deleteById` (línea 57): usa `prisma.inventoryItem.delete` (hard delete) — viola soft-delete.
  - `findById` (línea 65): usa `findUnique` — bypasea la extensión de soft-delete.

## Desired End State

Al finalizar este plan:

1. Los productos tienen un campo `inventoryTracking: UNIT | QUANTITY`.
2. Al crear inventario para un producto UNIT, se crean N `InventoryItem`s con `assetCode` auto-generado (ej. `BRIDE-001-01`).
3. Al crear inventario para un producto QUANTITY, se crea 1 `InventoryItem` con `quantityOnHand = N`.
4. Al crear/editar un pedido con un item UNIT, el usuario selecciona el `InventoryItem` específico.
5. La edición de pedido usa diff por item (no delete-all+recreate).
6. Al confirmar un pedido (QUOTE→CONFIRMED), el `quantityOnHand` se decrementa para items QUANTITY.
7. Al cancelar un pedido confirmado, el `quantityOnHand` se restaura.

### Verificación:
- Crear producto DRESS con `inventoryTracking=UNIT`, agregar 3 unidades → aparecen 3 InventoryItems con códigos `BRIDE-001-01`, `BRIDE-001-02`, `BRIDE-001-03`.
- Crear producto ACCESORIO con `inventoryTracking=QUANTITY`, agregar 10 unidades → aparece 1 InventoryItem con `quantityOnHand=10`.
- Crear pedido con item RENTAL de un vestido → el selector de InventoryItem aparece mostrando unidades disponibles.
- Confirmar pedido con accesorio (qty 2) → `quantityOnHand` baja de 10 a 8.
- Cancelar ese pedido → `quantityOnHand` vuelve a 10.

---

## Key Discoveries

- `OrderItem.inventoryItemId` ya existe en schema/repo/validación — solo falta UI (`src/lib/validations/order.ts:6`).
- `PRODUCT_TYPE_LABELS` vive en `src/lib/constants/categories.ts` — aquí va `INVENTORY_TRACKING_LABELS`.
- Patrón del selector de entidad: `EntitySelectorTrigger` + `EntitySelectorModal` (ya usado en `OrderItemRow`).
- La re-asociación de rentals en `updateInTransaction` usa `productId` como clave de matching — esto debe cambiar a `orderItemId` (id del item) en el nuevo diff.
- `updateStatusInTransaction` es **batch** (`prisma.$transaction([])`). Phase 6 cambia a **interactive** — desviación justificada de CLAUDE.md §6 por requerimiento de integridad de datos (§1 tiene prioridad).

## What We're NOT Doing

- No se crea estado `RESERVED` en `InventoryStatus` (fuera de scope).
- No se decrementa `quantityOnHand` para productos UNIT (se usa el status del InventoryItem).
- No se implementa selector de InventoryItem en el flujo de edición individual de item (`order-item-edit-form.tsx`) en esta versión.
- No se migran pedidos históricos con `inventoryItemId = null`.
- No se agrega automatización de status (`RENTED`/`SOLD`) al confirmar pedido (fuera de scope).

---

## Phase 1: Schema — InventoryTracking + assetCode

### Overview

Agregar el enum `InventoryTracking`, el campo `inventoryTracking` a `Product` y `assetCode` a `InventoryItem`. Ejecutar migración.

### Changes Required

#### 1. `prisma/schema.prisma`

Agregar el enum (después del enum `DiscountType` al final del archivo):

```prisma
enum InventoryTracking {
  UNIT
  QUANTITY
}
```

Agregar campo a `Product` (después de `isActive`):

```prisma
model Product {
  // ... campos existentes ...
  isActive           Boolean          @default(true)
  inventoryTracking  InventoryTracking @default(QUANTITY)   // <-- agregar
  createdAt          DateTime         @default(now())
  // ...
}
```

Agregar campo a `InventoryItem` (después de `notes`):

```prisma
model InventoryItem {
  // ... campos existentes ...
  notes          String?
  assetCode      String?         @unique                  // <-- agregar
  createdAt      DateTime        @default(now())
  // ...
  @@index([productId])
  @@index([status])
  @@index([assetCode])                                    // <-- agregar
  @@index([deletedAt])
}
```

### Success Criteria

#### Automated Verification:
- [x] Migración aplica sin error: `npx prisma migrate dev --name add-inventory-tracking-asset-code`
- [x] `npx prisma generate` completa sin errores
- [x] TypeScript compila: `npx tsc --noEmit`

#### Manual Verification:
- [ ] El cliente Prisma generado expone `InventoryTracking` como tipo
- [ ] La tabla `InventoryItem` en DB tiene columna `assetCode` (verificar en psql o Prisma Studio)
- [ ] La tabla `Product` tiene columna `inventoryTracking` con default `QUANTITY`

**Pausa aquí para confirmación manual antes de continuar al Phase 2.**

---

## Phase 2: Product Layer — campo inventoryTracking

### Overview

Exponer `inventoryTracking` en la capa de productos: validación, constantes, servicio, repo y formulario.

### Changes Required

#### 1. `src/lib/constants/categories.ts`

Agregar el nuevo mapa de labels:

```typescript
export const INVENTORY_TRACKING_LABELS: Record<string, string> = {
  UNIT: "Por unidad",
  QUANTITY: "Por cantidad",
};
```

#### 2. `src/lib/validations/product.ts`

Agregar `inventoryTracking` al schema (con default `QUANTITY`):

```typescript
import { z } from "zod";

export const productSchema = z.object({
  code: z.string().min(1, "El código es obligatorio"),
  name: z.string().min(1, "El nombre es obligatorio"),
  type: z.enum(["RENTAL", "SALE", "BOTH"]),
  inventoryTracking: z.enum(["UNIT", "QUANTITY"]).default("QUANTITY"),  // <-- agregar
  categoryId: z.string().nullable().optional(),
  salePrice: z.number().nullable().optional(),
  rentalPrice: z.number().nullable().optional(),
  cost: z.number().nullable().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});
```

#### 3. `src/features/products/products.repo.ts`

En la función `create` y `update`, incluir `inventoryTracking` en el `data`:

```typescript
// En create():
data: {
  code: data.code,
  name: data.name,
  type: data.type,
  inventoryTracking: data.inventoryTracking,  // <-- agregar
  categoryId: data.categoryId || null,
  // ...resto igual
}

// En update():
data: {
  code: data.code,
  name: data.name,
  type: data.type,
  inventoryTracking: data.inventoryTracking,  // <-- agregar
  // ...resto igual
}
```

#### 4. `src/app/productos/product-form.tsx`

Importar `INVENTORY_TRACKING_LABELS` y agregar campo `inventoryTracking` con `Select` en el formulario (en la misma fila que `type`):

```tsx
import { PRODUCT_TYPE_LABELS, INVENTORY_TRACKING_LABELS } from "@/lib/constants/categories";

// En el grid de tipo (que ya existe):
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  {/* Campo type — ya existe */}
  <FormField
    control={form.control}
    name="type"
    // ...sin cambios
  />
  {/* Campo inventoryTracking — NUEVO */}
  <FormField
    control={form.control}
    name="inventoryTracking"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Seguimiento de inventario</FormLabel>
        <Select value={field.value} onValueChange={field.onChange}>
          <FormControl>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {Object.entries(INVENTORY_TRACKING_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
</div>
```

**Nota**: El `defaultValues` del formulario ya incluirá `inventoryTracking: "QUANTITY"` por el default de Zod.

#### 5. `src/app/productos/[id]/page.tsx` (detail)

Agregar `inventoryTracking` a la visualización del detalle del producto (junto a `type`).

### Success Criteria

#### Automated Verification:
- [x] TypeScript compila: `npx tsc --noEmit`
- [ ] El formulario de producto renderiza sin errores

#### Manual Verification:
- [ ] El formulario de producto muestra el campo "Seguimiento de inventario" con opciones "Por unidad" / "Por cantidad"
- [ ] Default es "Por cantidad" en nuevos productos
- [ ] Crear un producto con `inventoryTracking=UNIT` → persiste correctamente en DB
- [ ] Editar un producto existente → el campo muestra el valor guardado
- [ ] La página de detalle del producto muestra el valor de seguimiento

**Pausa aquí para confirmación manual antes de continuar al Phase 3.**

---

## Phase 3: Inventory Layer — assetCode, creación bulk y corrección de bugs

### Overview

Corregir los dos bugs de repo. Implementar generación de `assetCode` y creación masiva de unidades para UNIT. Actualizar el formulario de creación y la tabla de inventario.

### Changes Required

#### 1. `src/features/inventory/inventory.repo.ts`

**Bug fix 1** — Soft delete en lugar de hard delete:
```typescript
// ANTES (línea 57):
export function deleteById(id: string) {
  return prisma.inventoryItem.delete({ where: { id } });
}

// DESPUÉS:
export function deleteById(id: string) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

**Bug fix 2** — `findFirst` en lugar de `findUnique`:
```typescript
// ANTES (línea 65):
export function findById(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: { product: true },
  });
}

// DESPUÉS:
export function findById(id: string) {
  return prisma.inventoryItem.findFirst({
    where: { id },
    include: { product: true },
  });
}
```

**Nuevas funciones** para soporte de assetCode y creación bulk:
```typescript
// Obtener assetCodes existentes de un producto (para calcular siguiente sufijo)
export function findAssetCodesByProductId(productId: string) {
  return prisma.inventoryItem.findMany({
    where: { productId },
    select: { assetCode: true },
  });
}

// Crear múltiples InventoryItems en una transacción
export function createMany(
  items: Array<{
    productId: string;
    quantityOnHand: number;
    status: InventoryStatus;
    assetCode: string | null;
    notes: string | null;
  }>
) {
  return prisma.$transaction(
    items.map((item) => prisma.inventoryItem.create({ data: item }))
  );
}

// Obtener items AVAILABLE de un producto (para selector en pedidos)
export function findAvailableByProductId(productId: string) {
  return prisma.inventoryItem.findMany({
    where: { productId, status: "AVAILABLE" },
    include: { product: true },
    orderBy: { assetCode: "asc" },
  });
}
```

#### 2. `src/features/inventory/inventory.service.ts`

Refactorizar `createInventoryItem` para soportar UNIT (N items) y QUANTITY (1 item):

```typescript
import type { InventoryTracking } from "@prisma/client";

// Helper puro — genera N assetCodes para un producto dado
function generateAssetCodes(
  productCode: string,
  existingCodes: (string | null)[],
  count: number
): string[] {
  const suffixes = existingCodes
    .filter(Boolean)
    .map((c) => {
      const match = c!.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const maxSuffix = suffixes.length > 0 ? Math.max(...suffixes) : 0;
  return Array.from({ length: count }, (_, i) => {
    const n = maxSuffix + i + 1;
    return `${productCode}-${String(n).padStart(2, "0")}`;
  });
}

export async function createInventoryItem(data: {
  productId: string;
  productCode: string;         // código del producto para generar assetCode
  inventoryTracking: InventoryTracking;
  unitCount?: number;          // para UNIT: cuántas unidades físicas crear
  quantityOnHand?: number;     // para QUANTITY: stock total
  notes?: string;
}): Promise<ActionResult<{ ids: string[] }>> {
  if (!data.productId) {
    return { success: false, error: "Seleccione un producto" };
  }

  if (data.inventoryTracking === "UNIT") {
    const count = data.unitCount ?? 1;
    const existingCodes = await repo.findAssetCodesByProductId(data.productId);
    const codes = generateAssetCodes(
      data.productCode,
      existingCodes.map((r) => r.assetCode),
      count
    );
    const items = await repo.createMany(
      codes.map((code) => ({
        productId: data.productId,
        quantityOnHand: 1,
        status: "AVAILABLE" as const,
        assetCode: code,
        notes: data.notes || null,
      }))
    );
    return { success: true, data: { ids: items.map((i) => i.id) } };
  } else {
    // QUANTITY: 1 InventoryItem con quantityOnHand = N
    const item = await repo.create({
      productId: data.productId,
      quantityOnHand: data.quantityOnHand ?? 1,
      status: "AVAILABLE",
      assetCode: null,
      notes: data.notes || null,
    });
    return { success: true, data: { ids: [item.id] } };
  }
}
```

**Nota**: El servicio necesita `productCode` y `inventoryTracking`. El action obtiene estos datos del producto antes de llamar al servicio.

#### 3. `src/lib/actions/inventory.ts`

Actualizar la action de crear para obtener el producto y pasar los datos requeridos:

```typescript
// Dentro de la action createInventoryItem:
// 1. Obtener el producto para conocer code e inventoryTracking
const product = await getProductForInventory(productId);  // nuevo repo call
if (!product) return { success: false, error: "Producto no encontrado" };

// 2. Llamar al servicio con los datos del producto
const result = await inventoryService.createInventoryItem({
  productId,
  productCode: product.code,
  inventoryTracking: product.inventoryTracking,
  unitCount: formData.unitCount,
  quantityOnHand: formData.quantityOnHand,
  notes: formData.notes,
});
```

Agregar en `inventory.repo.ts` (o product.repo.ts si se prefiere):
```typescript
export function findProductForInventory(productId: string) {
  return prisma.product.findFirst({
    where: { id: productId },
    select: { code: true, inventoryTracking: true },
  });
}
```

**Importante**: El repo de inventario puede consultar `prisma.product` — es una query de lectura sin lógica de negocio, aceptable en este contexto ya que la acción de inventario necesita el dato. Alternativamente, la action puede importar el repo de productos directamente. Dado que las actions son la capa de adaptación, importar múltiples repos desde una action es aceptable.

#### 4. `src/app/inventario/nuevo/inventory-item-form.tsx`

Actualizar la interfaz `ProductOption` y el formulario:
- Agregar `inventoryTracking: "UNIT" | "QUANTITY"` a `ProductOption`
- Al seleccionar producto, detectar si es UNIT o QUANTITY
- Si UNIT: mostrar campo "Cantidad de unidades" (número ≥ 1)
- Si QUANTITY: mostrar campo "Cantidad en stock" (número ≥ 0)
- El campo cambia de label y semántica según el tipo

```tsx
// Dentro de handleProductChange:
setSelectedTracking(product.inventoryTracking);

// En el render, condicional:
{selectedTracking === "UNIT" ? (
  <div>
    <label>Cantidad de unidades a crear</label>
    <Input type="number" min={1} value={unitCount} onChange={...} />
    <p className="text-xs text-muted-foreground">
      Se creará un item por unidad física con código auto-generado
    </p>
  </div>
) : (
  <div>
    <label>Cantidad en stock</label>
    <Input type="number" min={0} value={quantityOnHand} onChange={...} />
  </div>
)}
```

#### 5. `src/app/inventario/page.tsx` + `inventory-table.tsx`

Agregar columna `assetCode` en la tabla de inventario:
- Columna nueva: "Código unidad" → muestra `item.assetCode ?? "—"`
- Agregar `hidden sm:table-cell` si la tabla tiene ≥ 8 columnas

#### 6. `src/app/inventario/[id]/page.tsx`

Mostrar `assetCode` en el detalle del InventoryItem.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compila: `npx tsc --noEmit`
- [x] La migración ya fue ejecutada en Phase 1

#### Manual Verification:
- [ ] Crear inventario de un producto UNIT con cantidad 3 → se crean 3 InventoryItems con `assetCode` PROD-001-01, PROD-001-02, PROD-001-03
- [ ] Crear inventario de un producto QUANTITY con cantidad 10 → se crea 1 InventoryItem con `quantityOnHand=10`
- [ ] Agregar más unidades UNIT al mismo producto → el sufijo continúa desde el máximo existente
- [ ] La tabla de inventario muestra la columna `assetCode`
- [ ] El soft-delete de un InventoryItem ya no hace hard-delete en DB
- [ ] El detalle de InventoryItem carga correctamente (fix de `findUnique`)

**Pausa aquí para confirmación manual antes de continuar al Phase 4.**

---

## Phase 4: Orders — Selector de InventoryItem para productos UNIT

### Overview

Cuando el usuario agrega un item de tipo SALE o RENTAL en un pedido y el producto seleccionado tiene `inventoryTracking=UNIT`, aparece un selector de `InventoryItem` específico. Para QUANTITY, no aparece selector de unidad.

### Changes Required

#### 1. `src/app/pedidos/nuevo/page.tsx` y `src/app/pedidos/[id]/editar/page.tsx`

Fetcher: agregar query de InventoryItems disponibles para productos UNIT:

```typescript
// En el server component:
const [clients, products, inventoryItems] = await Promise.all([
  getClients(),
  getProducts(),
  getAvailableUnitInventoryItems(), // nuevo: solo status=AVAILABLE de productos UNIT
]);
```

Nueva función en `inventory.service.ts`:
```typescript
export function getAvailableUnitInventoryItems() {
  return repo.findAvailableUnitItems();
}
```

Nueva función en `inventory.repo.ts`:
```typescript
export function findAvailableUnitItems() {
  return prisma.inventoryItem.findMany({
    where: {
      status: "AVAILABLE",
      product: { inventoryTracking: "UNIT" },
    },
    include: { product: true },
    orderBy: { assetCode: "asc" },
  });
}
```

#### 2. `src/components/orders/OrderForm.tsx`

**Cambios en interfaces**:
```typescript
interface ProductOption {
  id: string;
  code: string;
  name: string;
  type: string;
  inventoryTracking: "UNIT" | "QUANTITY";  // <-- agregar
  salePrice: number | null;
  rentalPrice: number | null;
  cost: number | null;
  description: string | null;
}

interface InventoryItemOption {
  id: string;
  assetCode: string | null;
  productId: string;
  status: string;
}

interface OrderFormProps {
  clients: ClientOption[];
  products: ProductOption[];
  inventoryItems: InventoryItemOption[];  // <-- agregar
  initialData?: { ... };
}
```

**Cambios en `emptyItem`**:
```typescript
const emptyItem = {
  itemType: "SALE" as string,
  productId: "",
  inventoryItemId: null as string | null,  // <-- agregar
  name: "",
  // ...resto igual
};
```

**Pasar `inventoryItems` a `OrderItemRow`**.

**En `handleSubmit`**, incluir `inventoryItemId`:
```typescript
items: items.map((i) => ({
  // ...campos existentes...
  inventoryItemId: i.inventoryItemId || null,   // <-- agregar
  // ...
})),
```

#### 3. `src/components/orders/OrderItemRow.tsx`

**Cambios en interfaz del item**:
```typescript
interface OrderItemRowProps {
  // ...
  item: {
    // ...campos existentes...
    inventoryItemId: string | null;  // <-- agregar
  };
  inventoryItems: InventoryItemOption[];  // <-- agregar
  // ...
}
```

**Lógica del selector de unidad**:

Cuando el tipo es SALE o RENTAL y el producto seleccionado tiene `inventoryTracking === "UNIT"`, renderizar selector de InventoryItem debajo del selector de producto:

```tsx
// Después del selector de producto, dentro del bloque no-SERVICE:
{selectedProduct && selectedProduct.inventoryTracking === "UNIT" && (
  <div className="sm:col-span-1 md:col-span-4">
    <label className="text-xs font-medium text-muted-foreground mb-1 block">
      Unidad física
    </label>
    <EntitySelectorTrigger
      placeholder="Seleccionar unidad..."
      displayValue={
        item.inventoryItemId
          ? (inventoryItems.find((ii) => ii.id === item.inventoryItemId)?.assetCode ?? "Sin código")
          : undefined
      }
      onClick={() => setInventorySelectorOpen(true)}
      onClear={() => onChange(index, "inventoryItemId", null)}
    />
    <EntitySelectorModal
      open={inventorySelectorOpen}
      onOpenChange={setInventorySelectorOpen}
      title="Seleccionar Unidad"
      searchPlaceholder="Buscar por código..."
      items={inventoryItems.filter(
        (ii) => ii.productId === item.productId
      )}
      columns={inventoryItemColumns}
      searchFilter={(ii, q) =>
        (ii.assetCode ?? "").toLowerCase().includes(q.toLowerCase())
      }
      getItemId={(ii) => ii.id}
      selectedId={item.inventoryItemId ?? undefined}
      onSelect={(ii) => {
        onChange(index, "inventoryItemId", ii.id);
        setInventorySelectorOpen(false);
      }}
    />
  </div>
)}
```

**Al cambiar de producto** (en `handleProductChange`): limpiar `inventoryItemId`:
```typescript
function handleProductChange(productId: string) {
  const product = products.find((p) => p.id === productId);
  onChange(index, "productId", productId);
  onChange(index, "inventoryItemId", null);  // <-- limpiar al cambiar producto
  // ...resto igual
}
```

**Al cambiar de tipo** (en `handleTypeChange`): también limpiar `inventoryItemId`:
```typescript
function handleTypeChange(newType: string) {
  onChange(index, "itemType", newType);
  onChange(index, "inventoryItemId", null);  // <-- limpiar al cambiar tipo
  // ...resto igual
}
```

#### 4. `src/lib/validations/order.ts`

`inventoryItemId` ya existe en el schema — verificar que esté incluido correctamente. No se necesitan cambios si ya está ahí.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compila: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Crear pedido con item RENTAL de vestido UNIT → aparece selector "Unidad física" con las unidades disponibles
- [ ] El selector muestra el `assetCode` de cada unidad
- [ ] Seleccionar unidad → el `inventoryItemId` se guarda en el pedido
- [ ] Crear pedido con item SALE de accesorio QUANTITY → NO aparece selector de unidad
- [ ] Recargar el pedido creado → el item muestra la unidad asignada

**Pausa aquí para confirmación manual antes de continuar al Phase 5.**

---

## Phase 5: Orders — Estrategia Per-Item Diff en updateInTransaction

### Overview

Cambiar la edición de pedidos de delete-all+recreate-all a una estrategia diff por item. Esto preserva `inventoryItemId` en items existentes y permite el correcto re-matching de rentals.

**Motivación**: La estrategia actual destruye los `inventoryItemId` asignados (Phase 4) porque soft-delete todos los items y recrea nuevos con id distinto.

### Changes Required

#### 1. `src/lib/validations/order.ts`

Agregar `id` opcional al `orderItemSchema`:

```typescript
export const orderItemSchema = z.object({
  id: z.string().optional(),  // <-- agregar: presente si es item existente
  inventoryItemId: z.string().optional().nullable(),
  itemType: z.enum(["SALE", "RENTAL", "SERVICE"]),
  productId: z.string().nullable().optional(),
  // ...resto igual sin cambios
});
```

#### 2. `src/components/orders/OrderForm.tsx`

**En `emptyItem`**: agregar `id` (vacío para items nuevos):
```typescript
const emptyItem = {
  id: undefined as string | undefined,  // <-- agregar
  itemType: "SALE" as string,
  productId: "",
  inventoryItemId: null as string | null,
  // ...resto igual
};
```

**En inicialización de items**: cuando hay `initialData`, incluir el id de cada item:
```typescript
const [items, setItems] = useState<typeof emptyItem[]>(
  initialData?.items.length
    ? initialData.items.map((item) => ({
        id: item.id,  // <-- preservar id del item existente
        itemType: item.itemType,
        productId: item.productId,
        inventoryItemId: item.inventoryItemId ?? null,
        // ...resto de campos igual
      }))
    : [{ ...emptyItem }]
);
```

**En `OrderFormProps.initialData.items`**: agregar `id: string` e `inventoryItemId: string | null`:
```typescript
initialData?: {
  // ...campos de orden igual
  items: {
    id: string;              // <-- agregar
    itemType: string;
    productId: string;
    inventoryItemId: string | null;  // <-- agregar
    // ...resto igual
  }[];
};
```

**En `handleSubmit`**: incluir `id` en cada item:
```typescript
items: items.map((i) => ({
  id: i.id || undefined,        // <-- agregar: undefined = item nuevo
  itemType: i.itemType as "SALE" | "RENTAL" | "SERVICE",
  inventoryItemId: i.inventoryItemId || null,
  // ...resto igual
})),
```

#### 3. `src/features/orders/orders.repo.ts` — `updateInTransaction`

Reemplazar la función completa con estrategia diff:

```typescript
export function updateInTransaction(
  id: string,
  orderData: OrderData,
  items: OrderItemFormData[]
) {
  return prisma.$transaction(async (tx) => {
    // 1. Obtener items existentes con sus rentals
    const existingItems = await tx.orderItem.findMany({
      where: { orderId: id },
      include: { rental: true },
    });

    // 2. Clasificar items del form
    const itemsWithId = items.filter((i) => i.id);       // items a actualizar
    const itemsWithoutId = items.filter((i) => !i.id);   // items a crear

    // 3. Items a eliminar: los que existen en DB pero no están en el form
    const keptIds = new Set(itemsWithId.map((i) => i.id));
    const itemsToDelete = existingItems.filter((ei) => !keptIds.has(ei.id));

    // 4. Nullear orderItemId en rentals de items a eliminar
    const deleteIds = itemsToDelete.map((i) => i.id);
    if (deleteIds.length > 0) {
      await tx.rental.updateMany({
        where: { orderItemId: { in: deleteIds } },
        data: { orderItemId: null },
      });
      await tx.orderItem.updateMany({
        where: { id: { in: deleteIds } },
        data: { deletedAt: new Date() },
      });
    }

    // 5. Actualizar items existentes (preserva inventoryItemId y id)
    for (const item of itemsWithId) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
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
        },
      });
    }

    // 6. Actualizar totales de la orden
    await tx.order.update({
      where: { id },
      data: {
        clientId: orderData.clientId,
        orderDate: orderData.orderDate,
        eventDate: orderData.eventDate ?? null,
        deliveryDate: orderData.deliveryDate ?? null,
        totalPrice: orderData.totalPrice,
        totalCost: orderData.totalCost,
        adjustmentAmount: orderData.adjustmentAmount,
        adjustmentReason: orderData.adjustmentReason || null,
        minDownpaymentPct: orderData.minDownpaymentPct,
        notes: orderData.notes || null,
      },
    });

    // 7. Crear nuevos items
    const createdItems = await Promise.all(
      itemsWithoutId.map((item) =>
        tx.orderItem.create({
          data: {
            orderId: id,
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
          },
        })
      )
    );

    // 8. Gestionar rentals de items actualizados (matching por id existente)
    for (const item of itemsWithId) {
      if (item.itemType !== "RENTAL") continue;
      const existingItem = existingItems.find((ei) => ei.id === item.id);
      if (!existingItem) continue;

      if (existingItem.rental) {
        // Re-asociar rental existente (ya tiene orderItemId correcto, solo actualizar fechas)
        await tx.rental.update({
          where: { id: existingItem.rental.id },
          data: {
            ...(item.rentalReturnDate !== undefined && { returnDate: item.rentalReturnDate ?? null }),
            ...(item.rentalDeposit !== undefined && { deposit: item.rentalDeposit ?? 0 }),
          },
        });
      } else {
        // Crear nuevo rental para item existente que ahora es RENTAL
        await tx.rental.create({
          data: {
            orderItemId: item.id!,
            returnDate: item.rentalReturnDate ?? null,
            deposit: item.rentalDeposit ?? 0,
          },
        });
      }
    }

    // 9. Crear rentals para nuevos items RENTAL
    for (let i = 0; i < itemsWithoutId.length; i++) {
      const formItem = itemsWithoutId[i];
      const createdItem = createdItems[i];
      if (formItem.itemType !== "RENTAL") continue;
      await tx.rental.create({
        data: {
          orderItemId: createdItem.id,
          returnDate: formItem.rentalReturnDate ?? null,
          deposit: formItem.rentalDeposit ?? 0,
        },
      });
    }
  });
}
```

#### 4. `src/app/pedidos/[id]/editar/page.tsx`

Al construir `initialData`, incluir `id` e `inventoryItemId` de cada item:
```typescript
items: order.items.map((item) => ({
  id: item.id,
  itemType: item.itemType,
  productId: item.productId ?? "",
  inventoryItemId: item.inventoryItemId ?? null,
  // ...resto de campos igual
})),
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compila: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Editar un pedido con 3 items → los 3 items se cargan con sus datos correctos
- [ ] Modificar precio de un item existente → el item mantiene su `id` y `inventoryItemId` en DB
- [ ] Agregar un item nuevo → se crea con `id` nuevo, sin destruir los existentes
- [ ] Eliminar un item → solo ese item queda soft-deleted, los demás intactos
- [ ] Item RENTAL existente → su `Rental` se preserva con la misma relación
- [ ] Item RENTAL nuevo → se crea su `Rental`
- [ ] Verificar en DB que el `inventoryItemId` del item editado no se pierde

**Pausa aquí para confirmación manual antes de continuar al Phase 6.**

---

## Phase 6: Automatización de Stock para QUANTITY

### Overview

Al confirmar un pedido (QUOTE→CONFIRMED), decrementar `quantityOnHand` de los `InventoryItem` de productos QUANTITY involucrados. Al cancelar un pedido confirmado, restaurar el stock.

**Desviación de CLAUDE.md §6**: `updateStatusInTransaction` cambia de **batch** a **interactive** porque la automatización de stock requiere lógica condicional (`if inventoryTracking === "QUANTITY"`). Esta desviación está justificada por CLAUDE.md §1 (integridad de datos) — el usuario ha aprobado explícitamente la automatización de stock.

### Changes Required

#### 1. `src/features/inventory/inventory.repo.ts`

Agregar función de ajuste de cantidad:
```typescript
export function adjustQuantityOnHand(
  id: string,
  delta: number,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
) {
  return tx.inventoryItem.update({
    where: { id },
    data: { quantityOnHand: { increment: delta } },
  });
}
```

Agregar función para obtener InventoryItem por productId (para QUANTITY):
```typescript
export function findByProductId(productId: string) {
  return prisma.inventoryItem.findFirst({
    where: { productId },
    select: { id: true, quantityOnHand: true },
  });
}
```

#### 2. `src/features/orders/orders.repo.ts`

Agregar función para obtener items de una orden con info de inventoryTracking:
```typescript
export function findOrderItemsForStockAdjustment(orderId: string) {
  return prisma.orderItem.findMany({
    where: { orderId },
    select: {
      id: true,
      quantity: true,
      itemType: true,
      product: {
        select: {
          inventoryTracking: true,
          inventoryItems: {
            where: { deletedAt: null },
            select: { id: true, quantityOnHand: true },
            take: 1,
          },
        },
      },
    },
  });
}
```

#### 3. `src/features/orders/orders.repo.ts` — `updateStatusInTransaction`

Cambiar de batch a interactive transaction. La función ahora recibe la lógica de ajuste de stock como callback:

```typescript
export function updateStatusInTransaction(
  id: string,
  newStatus: OrderStatus,
  oldStatus: OrderStatus,
  stockAdjustments: Array<{ inventoryItemId: string; delta: number }>
) {
  return prisma.$transaction(async (tx) => {
    // 1. Actualizar estado de la orden
    await tx.order.update({
      where: { id },
      data: { status: newStatus },
    });

    // 2. Registro de auditoría
    await tx.auditLog.create({
      data: {
        entity: "Order",
        entityId: id,
        action: "STATUS_CHANGE",
        oldValue: oldStatus,
        newValue: newStatus,
        orderId: id,
      },
    });

    // 3. Ajustes de stock (si los hay)
    for (const adj of stockAdjustments) {
      await tx.inventoryItem.update({
        where: { id: adj.inventoryItemId },
        data: { quantityOnHand: { increment: adj.delta } },
      });
    }
  });
}
```

#### 4. `src/features/orders/orders.service.ts` — `updateOrderStatus`

Actualizar para calcular y pasar ajustes de stock:

```typescript
export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<ActionResult> {
  const order = await ordersRepo.findByIdSimple(id);
  if (!order) return { success: false, error: "Pedido no encontrado" };

  const oldStatus = order.status;

  if (!isValidTransition(oldStatus, newStatus)) {
    return { success: false, error: "Transición de estado no válida" };
  }

  // Calcular ajustes de stock para transiciones relevantes
  const stockAdjustments: Array<{ inventoryItemId: string; delta: number }> = [];

  const needsDecrement = oldStatus === "QUOTE" && newStatus === "CONFIRMED";
  const needsRestore = newStatus === "CANCELLED" && oldStatus !== "QUOTE";

  if (needsDecrement || needsRestore) {
    const orderItems = await ordersRepo.findOrderItemsForStockAdjustment(id);

    for (const item of orderItems) {
      if (!item.product || item.product.inventoryTracking !== "QUANTITY") continue;
      if (item.itemType === "SERVICE") continue;

      const inventoryItem = item.product.inventoryItems[0];
      if (!inventoryItem) continue;

      const delta = needsDecrement ? -item.quantity : item.quantity;
      stockAdjustments.push({ inventoryItemId: inventoryItem.id, delta });
    }
  }

  await ordersRepo.updateStatusInTransaction(id, newStatus, oldStatus, stockAdjustments);
  return { success: true, data: undefined };
}
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compila: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Crear pedido con accesorio QUANTITY (qty 2, stock inicial 10)
- [ ] Confirmar pedido (QUOTE→CONFIRMED) → `quantityOnHand` baja a 8
- [ ] Cancelar ese pedido (CONFIRMED→CANCELLED) → `quantityOnHand` vuelve a 10
- [ ] Cancelar un pedido en QUOTE → stock NO cambia (estaba en 10, sigue en 10)
- [ ] Cancelar un pedido en IN_PROGRESS → stock se restaura correctamente
- [ ] Items SERVICE no afectan el stock
- [ ] Items UNIT no afectan el stock (solo items QUANTITY)
- [ ] El AuditLog sigue registrando el cambio de estado correctamente

**Pausa aquí para confirmación manual del comportamiento de stock.**

---

## Testing Strategy

### Manual Testing Steps:

**Setup (antes de probar):**
1. Crear categoría "Vestidos"
2. Crear producto DRESS `inventoryTracking=UNIT`, code="VES-001"
3. Crear inventario para VES-001, cantidad 3 → verificar VES-001-01, VES-001-02, VES-001-03
4. Crear producto "Velo" `inventoryTracking=QUANTITY`, code="ACC-001"
5. Crear inventario para ACC-001, cantidad 5

**Flujo de pedido UNIT:**
1. Crear pedido con item RENTAL del vestido VES-001
2. Verificar que aparece selector "Unidad física" con las 3 opciones
3. Seleccionar VES-001-02
4. Guardar y verificar que `inventoryItemId` está en la DB
5. Editar el pedido → verificar que VES-001-02 sigue seleccionado
6. Confirmar pedido → stock del velo (si lo hay) se decrementa

**Flujo de stock QUANTITY:**
1. Crear pedido con item SALE del velo ACC-001, qty 2
2. Estado inicial: `quantityOnHand = 5`
3. Confirmar pedido → `quantityOnHand = 3`
4. Cancelar pedido → `quantityOnHand = 5`

---

## Performance Considerations

- `findAvailableUnitItems()` carga todos los InventoryItems UNIT disponibles al abrir el form de pedido. Si el inventario crece mucho, considerar paginación o búsqueda dinámica (fuera de scope).
- `findOrderItemsForStockAdjustment` incluye relaciones anidadas — aceptable para el volumen esperado.

## Migration Notes

- Los productos existentes tendrán `inventoryTracking=QUANTITY` (default) — correcto para los accesorios actuales.
- Los InventoryItems existentes tendrán `assetCode=null` — correcto, se asignan solo en creaciones nuevas.
- Los pedidos existentes tendrán `inventoryItemId=null` en sus items — sin regresiones.

---

## References

- Research principal: `thoughts/shared/research/2026-02-26_13-05-41_[general]_inventario-unidad-vs-cantidad-estado-actual.md`
- Research de estado actual (inventario manual): `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`
- Patrón de actualización de inventario existente (rental return): `src/features/rentals/rentals.service.ts`
- Patrón EntitySelectorModal: `src/components/shared/EntitySelectorModal.tsx`
- Schema actual: `prisma/schema.prisma`
- Repo de órdenes (updateInTransaction): `src/features/orders/orders.repo.ts:113`
- Repo de inventario (bugs): `src/features/inventory/inventory.repo.ts:57,65`
- Constantes de tipos: `src/lib/constants/categories.ts`
