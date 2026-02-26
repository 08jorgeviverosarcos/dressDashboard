---
date: 2026-02-25T14:15:00-06:00
researcher: Claude
git_commit: 64bfb5d
branch: main
repository: dressDashboard
topic: "Entity Selector Modal v2 — ExpenseForm Order/OrderItem selector + Inventory add-item page + Product quick-create"
tags: [research, entity-selector, expenses, inventory, product, modal, v2]
status: complete
last_updated: 2026-02-25
last_updated_by: Claude
---

# Research: Entity Selector Modal v2

**Date**: 2026-02-25T14:15:00-06:00
**Researcher**: Claude
**Git Commit**: 64bfb5d
**Branch**: main
**Repository**: dressDashboard

## Research Question

Investigar el estado actual de tres flujos para planificar la implementación del v2 del Entity Selector Modal:

1. **ExpenseForm**: Reemplazar cascading selectors (Order → OrderItem) con un modal que muestre la orden y permita seleccionar el order item desde el mismo modal
2. **Inventario "Agregar Item"**: Cambiar de modal a una página dedicada
3. **Product quick-create**: Permitir crear productos desde el selector modal (actualmente solo permite seleccionar)

## Summary

El v1 del EntitySelectorModal (plan implementado) cubre 6 selectores con patrón modal + búsqueda + inline-create. El v2 requiere tres extensiones:

1. **ExpenseForm** usa dos `<Select>` cascading: uno para Order (estado local) y otro para OrderItem (RHF). Cambiar Order no es un simple selector — necesita mostrar información de la orden (items, status, total) y permitir seleccionar un OrderItem específico de esa orden. Es un patrón "master-detail" dentro de un modal.

2. **Inventario** usa un Dialog con `EntitySelectorTrigger` + `EntitySelectorModal` para productos (ya migrado en v1 Phase 7). El cambio es de patrón: reemplazar Dialog modal con una página dedicada `/inventario/nuevo`.

3. **Product quick-create** requiere un `ProductQuickForm` análogo a `CategoryQuickForm` y `ClientQuickForm` ya existentes, pero el formulario de producto tiene más campos (code, name, type, prices, category) y un mecanismo de auto-sugerencia de código.

---

## Detailed Findings

### 1. ExpenseForm — Current Cascading Order → OrderItem

**Ubicación**: `src/components/expenses/ExpenseForm.tsx`

#### Cómo funciona actualmente

El formulario tiene dos selectores separados:

**Order selector** (líneas 225-242) — NO es un FormField de RHF:
- Es un `<Select>` de shadcn con estado local `selectedOrderId` (useState)
- Value usa `selectedOrderId || "none"` con opción "Ninguno"
- Muestra cada orden como `"Pedido #N"`
- Al cambiar, resetea `orderItemId` vía `form.setValue("orderItemId", "")`

**OrderItem selector** (líneas 244-264) — SÍ es un FormField de RHF:
- Ligado a `name="orderItemId"` en el schema Zod
- Se deshabilita cuando `!selectedOrderId || filteredItems.length === 0`
- Muestra items como `"{code} — {name}"`
- `filteredItems` se calcula como: `orders.find(o => o.id === selectedOrderId)?.items ?? []`

**Datos que recibe** (desde page props):
```typescript
interface OrderOption {
  id: string;
  orderNumber: number;
  items: OrderItemOption[];  // { id, product: { name, code } }
}
```

Los datos vienen de `getOrders()` action → `orders.repo.findAll()` que incluye:
```typescript
items: { where: { deletedAt: null }, include: { product: true } }
```

**Estado en edit mode** (líneas 58-63):
```typescript
const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
  if (initialData?.orderItemId) {
    return orders.find((o) => o.items.some((i) => i.id === initialData.orderItemId))?.id ?? "";
  }
  return "";
});
```

**Lo que se persiste**: Solo `orderItemId` va al schema Zod y se envía al server. `selectedOrderId` es puramente UI.

#### Lo que necesita el v2

En lugar de dos dropdowns, un solo modal que:
1. Primero muestre una lista de órdenes (búsqueda por # de orden o nombre de cliente)
2. Al hacer clic en una orden, mostrar los items de esa orden en el mismo modal
3. Al hacer clic en un item, seleccionarlo y cerrar el modal

Es un patrón **master-detail** o **drill-down** — el `EntitySelectorModal` actual no lo soporta (es flat, una sola lista).

#### Datos disponibles en la query `findAll`

La query de órdenes (`orders.repo.findAll`, líneas 19-38) incluye:
- `client: true` → `order.client.name`
- `items: { where: { deletedAt: null }, include: { product: true } }`
- `payments: { where: { deletedAt: null } }` → para calcular pagado

**Campos de orden disponibles**: `orderNumber`, `status`, `client.name`, `orderDate`, `eventDate`, `totalPrice`, `items.length`

**Campos de item disponibles**: `id`, `itemType`, `name`, `product.code`, `product.name`, `quantity`, `unitPrice`

#### Schema Zod del expense

```typescript
// src/lib/validations/expense.ts
orderItemId: z.string().optional().nullable().or(z.literal("")),
```

El campo es completamente opcional — un gasto puede no estar ligado a ningún item.

---

### 2. InventoryTable — Current "Add Item" Dialog

**Ubicación**: `src/app/inventario/inventory-table.tsx`

#### Cómo funciona actualmente

El flujo "Agregar Item" es un Dialog inline dentro de `InventoryTable`:

**Estado** (líneas 58-67):
- `addOpen` — controla visibilidad del Dialog
- `newProductId`, `newProductName` — selección de producto
- `newQuantity` — cantidad (default 1)
- `newNotes` — notas opcionales
- `productSelectorOpen` — controla el EntitySelectorModal de producto

**Selector de producto** (líneas 211-232):
- Ya usa `EntitySelectorTrigger` + `EntitySelectorModal` (migrado en v1 Phase 7)
- Muestra 2 columnas: "Código" y "Nombre"
- Sin `allowCreate` — solo permite seleccionar, NO crear producto

**Submit** (`handleAdd`, líneas 90-112):
```typescript
await createInventoryItem({
  productId: newProductId,
  quantityOnHand: newQuantity,
  notes: newNotes || undefined,
});
```

**Server action** (`src/lib/actions/inventory.ts:15-24`):
- Sin Zod validation — acepta un objeto typed
- Delegación directa al service
- Revalidates `/inventario`

**Service** (`src/features/inventory/inventory.service.ts:12-30`):
- Guard: `if (!data.productId)` → error
- Defaults: `quantityOnHand ?? 1`, `status ?? "AVAILABLE"`, `notes || null`

#### Lo que necesita el v2

Dos cambios:
1. **Cambiar de Dialog a Page**: En lugar de abrir un modal, navegar a `/inventario/nuevo` (nueva página)
2. **Product selector con allowCreate**: En esa página, el selector de producto debe tener `allowCreate` que renderice un `ProductQuickForm`

#### Datos que pasa la page actual

`page.tsx:27` mapea productos a `{ id, code, name }` y los pasa como prop. Una nueva page haría lo mismo.

#### Routing actual

```
src/app/inventario/
├── page.tsx              — lista
├── inventory-table.tsx   — tabla con dialog inline
└── [id]/
    └── page.tsx          — detalle
```

No existe `/inventario/nuevo/` — habría que crear esa ruta.

---

### 3. Product Quick-Create — Current State

**No existe `ProductQuickForm`**. Solo existen:
- `CategoryQuickForm` en `src/features/products/components/CategoryQuickForm.tsx`
- `ClientQuickForm` en `src/features/clients/components/ClientQuickForm.tsx`

Ambos siguen el mismo patrón:
- Formulario controlled con `useState` (no RHF)
- Llaman un server action (`createCategory`, `createClient`)
- En success: `onCreated(result.data)` → el modal cierra y selecciona
- Usan `DialogFooter` para botones

#### Lo que necesita un `ProductQuickForm`

**Campos del productSchema**:
- `code` — requerido (min 1)
- `name` — requerido (min 1)
- `type` — requerido (enum: RENTAL, SALE, BOTH)
- `categoryId` — opcional/nullable
- `salePrice`, `rentalPrice`, `cost` — opcionales/nullable
- `description` — opcional

**Complejidad vs CategoryQuickForm**:
- Category tiene 2 campos (name, code)
- Client tiene 3 campos (name, phone, email)
- Product tiene ~7+ campos relevantes

**Code auto-suggestion**: En ProductForm, al seleccionar categoría se auto-sugiere un código. Un `ProductQuickForm` podría omitir esto para simplificar, o incluir solo category selector + auto-sugerencia.

**Server action existente**: `createProduct` en `src/lib/actions/products.ts:32-41` retorna `ActionResult<{ id: string }>`. El service valida unicidad de código (`repo.findByCode`).

**Consideración**: Si se usa el `ProductQuickForm` dentro de un `EntitySelectorModal` que ya está dentro de otro dialog (inventario → selector producto → crear producto), serían potencialmente 3 niveles de Dialog/modal. Radix UI los maneja con portales, pero la UX podría ser confusa.

---

## Code References

### ExpenseForm
- `src/components/expenses/ExpenseForm.tsx` — formulario completo
- `src/components/expenses/ExpenseForm.tsx:58-63` — inicialización de selectedOrderId
- `src/components/expenses/ExpenseForm.tsx:65` — filteredItems derivado
- `src/components/expenses/ExpenseForm.tsx:225-264` — cascading Order → OrderItem selectors
- `src/lib/validations/expense.ts:3-13` — Zod schema
- `src/lib/actions/expenses.ts:23-35` — createExpense action
- `src/features/expenses/expenses.service.ts:27-51` — createExpense service

### Inventory
- `src/app/inventario/inventory-table.tsx` — tabla con dialog add inline
- `src/app/inventario/inventory-table.tsx:58-67` — estado del formulario add
- `src/app/inventario/inventory-table.tsx:90-112` — handleAdd submit
- `src/app/inventario/inventory-table.tsx:211-232` — EntitySelector product (v1)
- `src/app/inventario/page.tsx:11-32` — data loading
- `src/lib/actions/inventory.ts:15-24` — createInventoryItem action
- `src/features/inventory/inventory.service.ts:12-30` — createInventoryItem service
- `src/features/inventory/inventory.repo.ts:27-34` — create repo

### Product
- `src/app/productos/product-form.tsx` — formulario completo con EntitySelector para categoría
- `src/lib/validations/product.ts:3-13` — Zod schema
- `src/lib/actions/products.ts:32-41` — createProduct action
- `src/features/products/products.service.ts:51-74` — createProduct service
- `src/features/products/products.repo.ts:69-71` — create repo

### Quick-Create existentes (patrón de referencia)
- `src/features/products/components/CategoryQuickForm.tsx` — 2 campos (name, code)
- `src/features/clients/components/ClientQuickForm.tsx` — 3 campos (name, phone, email)

### EntitySelectorModal (base actual)
- `src/components/shared/EntitySelectorModal.tsx` — modal genérico con search + create view
- `src/components/shared/EntitySelectorTrigger.tsx` — trigger button
- `src/components/shared/LocalSearchInput.tsx` — búsqueda local

### Order display patterns
- `src/app/pedidos/[id]/page.tsx` — detail page layout
- `src/app/pedidos/[id]/order-items-table.tsx` — items table con 9 columnas
- `src/features/orders/orders.repo.ts:19-38` — findAll query (datos disponibles para selector)
- `src/features/orders/orders.repo.ts:41-58` — findById query (datos completos)

---

## Architecture Insights

### Patrón actual del EntitySelectorModal

El modal actual es **flat**: una lista de entidades → búsqueda → seleccionar o crear. No tiene concepto de drill-down o niveles.

Para el ExpenseForm v2, se necesita un patrón **master-detail** o **two-level drill-down**:
- Nivel 1: Lista de órdenes
- Nivel 2: Detalle de orden con items seleccionables

Esto podría implementarse como:
1. Extender `EntitySelectorModal` con un prop `renderDetail` o similar (genérico)
2. Crear un componente específico `OrderItemSelectorModal` (no genérico)

### Patrón de página vs Dialog para inventario

Actualmente el add flow es un Dialog inline en la tabla. El cambio a página requiere:
- Nueva ruta `/inventario/nuevo/page.tsx` (Server Component)
- Nuevo componente `InventoryItemForm` (Client Component)
- Eliminar el Dialog inline del `InventoryTable`
- Cambiar el botón "Agregar" para que navegue con `router.push` o `Link`

### Datos SSR vs Client-side

Todo el patrón actual es SSR: los datos (products, orders, categories) se cargan en Server Components y se pasan como props. No hay fetching client-side. El v2 debe mantener este patrón.

---

## Historical Context (from thoughts/)

- **Plan v1**: `thoughts/shared/plans/2026-02-25_12-27-59_general_entity-selector-modal.md` — plan completo de 7 fases para EntitySelectorModal, donde explícitamente se excluye ExpenseForm: "NOT migrating ExpenseForm cascading selectors (Order → OrderItem) — deferred to v2"

---

## Open Questions

1. **ExpenseForm modal: ¿Un componente genérico o específico?**
   - ¿Extender `EntitySelectorModal` para soportar master-detail drill-down?
   - ¿O crear `OrderItemSelectorModal` como componente específico?

2. **ProductQuickForm: ¿Cuántos campos incluir?**
   - ¿Mínimo (code, name, type)?
   - ¿Completo (todos los campos del productSchema)?
   - ¿Con o sin auto-sugerencia de código por categoría?

3. **Inventario page: ¿Qué más incluir?**
   - ¿Solo product + quantity + notes (mismo que el dialog actual)?
   - ¿Agregar más campos (status, location, etc.)?

4. **Product quick-create en inventario: ¿Anidamiento de modales?**
   - La page de inventario → selector producto → crear producto = 1 nivel de modal (solo el EntitySelectorModal con create view)
   - Si el ProductQuickForm necesita selector de categoría, podría haber modal dentro de modal
