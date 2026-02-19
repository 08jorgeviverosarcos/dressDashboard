---
date: 2026-02-19T09:00:00-05:00
researcher: Claude Code
git_commit: 3278280
branch: main
repository: dressDashboard
topic: "Estado actual de Expense y su relacion con Order vs OrderItem"
tags: [research, codebase, expenses, orders, order-items, gastos, schema]
status: complete
last_updated: 2026-02-19
last_updated_by: Claude Code
---

# Research: Estado actual de Expense y su relacion con Order vs OrderItem

**Date**: 2026-02-19T09:00:00-05:00
**Researcher**: Claude Code
**Git Commit**: 3278280
**Branch**: main
**Repository**: dressDashboard

## Research Question

Necesito que expense no vaya relacionado a una Order sino a OrderItem, asi el usuario puede agregar gastos a un solo order item en caso de que una orden tenga varios orderItems y saber a que orderItem va ligado.

## Summary

Actualmente `Expense` tiene un `orderId` opcional que apunta a `Order`. No existe ninguna relacion directa entre `Expense` y `OrderItem`. El modelo `OrderItem` tiene un campo `costSource` (enum: INVENTORY, EXPENSES, MANUAL) que conceptualmente indica que el costo viene de un gasto, pero no hay FK que lo conecte a ningun `Expense` especifico. Para mover la relacion de `Order` a `OrderItem` se requieren cambios en: el schema de Prisma (nueva migration), el repo, el service, las actions, la validacion Zod, el componente `ExpenseForm`, y las paginas que renderizan la lista de gastos y el detalle del pedido.

---

## Detailed Findings

### 1. Modelo Expense (estado actual)

**Archivo:** `prisma/schema.prisma:128-146`

```prisma
model Expense {
  id            String        @id @default(cuid())
  date          DateTime
  category      String
  subcategory   String?
  description   String
  responsible   String?
  amount        Decimal       @db.Decimal(12, 2)
  expenseType   ExpenseType
  paymentMethod PaymentMethod
  orderId       String?           -- FK actual: apunta a Order
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  order         Order?        @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@index([date])
  @@index([category])
}
```

**Relacion actual:** `Expense.orderId` → `Order.id` (opcional, N:1).
La inversa vive en el modelo Order: `expenses Expense[]` (`schema.prisma:82`).

**Lo que NO existe:**
- No hay campo `orderItemId` en `Expense`
- No hay relacion entre `Expense` y `OrderItem`
- No hay inversa `expenses` en el modelo `OrderItem`

---

### 2. Modelo OrderItem (estado actual)

**Archivo:** `prisma/schema.prisma:93-109`

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
  inventoryItem   InventoryItem? @relation(...)
  order           Order          @relation(..., onDelete: Cascade)
  product         Product        @relation(...)

  @@index([orderId])
  @@index([productId])
}
```

**Campos relevantes para el cambio:**
- `costSource` — enum `CostSource` (INVENTORY | EXPENSES | MANUAL), actualmente siempre `"MANUAL"` al crear desde UI (`OrderForm.tsx:115`)
- `costAmount` — Decimal, costo por unidad

**Lo que NO existe:**
- Sin campo `expenses Expense[]`
- Sin inversa de ninguna relacion con Expense

---

### 3. CostSource Enum (estado actual)

**Archivo:** `prisma/schema.prisma:214-218`

```prisma
enum CostSource {
  INVENTORY   -- el costo vino del precio de costo del producto en inventario
  EXPENSES    -- el costo vino de un gasto asociado
  MANUAL      -- el costo fue ingresado a mano
}
```

El valor `EXPENSES` existe en el enum pero actualmente es solo un **label informativo**. No hay FK que conecte un `OrderItem` con un `Expense` concreto. En la UI (`OrderForm.tsx:115`), `costSource` siempre se hardcodea como `"MANUAL"` independientemente de si hay un gasto vinculado.

---

### 4. Relacion inversa en Order

**Archivo:** `prisma/schema.prisma:82`

```prisma
model Order {
  ...
  expenses  Expense[]   -- inversa de Expense.orderId
  items     OrderItem[]
  ...
}
```

Esta relacion (`Order.expenses`) es la que se usa para mostrar "Gastos Vinculados" en la pagina de detalle del pedido (`src/app/pedidos/[id]/page.tsx:194-224`).

---

### 5. Capa de Validacion Zod

**Archivo:** `src/lib/validations/expense.ts:1-15`

```typescript
export const expenseSchema = z.object({
  date: z.date(),
  category: z.string().min(1, "La categoria es requerida"),
  subcategory: z.string().optional().or(z.literal("")),
  description: z.string().min(1, "La descripcion es requerida"),
  responsible: z.string().optional().or(z.literal("")),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  expenseType: z.enum(["FIXED", "VARIABLE"]),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "NEQUI", "OTHER"]),
  orderId: z.string().optional().nullable().or(z.literal("")),  // <-- campo a reemplazar
});
export type ExpenseFormData = z.infer<typeof expenseSchema>;
```

El campo `orderId` es opcional/nullable. Este campo es el que se debe reemplazar por `orderItemId`.

---

### 6. Capa de Repositorio

**Archivo:** `src/features/expenses/expenses.repo.ts`

| Funcion | Linea | Descripcion |
|---------|-------|-------------|
| `findAll(filters?)` | 4-34 | `findMany` con `include: { order: { select: { id, orderNumber } } }` |
| `findById(id)` | 36-41 | `findUnique` con mismo include |
| `create(data)` | 43-55 | `prisma.expense.create({ data })`, pasa `orderId` directo como string |
| `update(id, data)` | 57-72 | `prisma.expense.update({ where: { id }, data })` |
| `deleteById(id)` | 74-76 | `prisma.expense.delete({ where: { id } })` |

El `include` en `findAll` y `findById` trae `order.id` y `order.orderNumber` para mostrar en la tabla. Si se cambia a `orderItemId`, este include debe cambiar a `orderItem: { select: { id, product: { select: { name, code } } } }` o similar.

---

### 7. Capa de Servicio

**Archivo:** `src/features/expenses/expenses.service.ts`

```typescript
// createExpense — lineas 19-35
const expense = await repo.create({
  ...otros campos...,
  orderId: parsed.orderId || null,   // <-- mapeo de FK actual
});

// updateExpense — lineas 37-54
await repo.update(id, {
  ...otros campos...,
  orderId: parsed.orderId || null,   // <-- mapeo de FK actual
});
```

El servicio mapea `parsed.orderId || null` en create y update. Este mapeo debe cambiar a `parsed.orderItemId || null`.

---

### 8. Server Actions

**Archivo:** `src/lib/actions/expenses.ts`

```typescript
// createExpense — lineas 23-31
const result = await service.createExpense(parsed.data);
if (result.success) revalidatePath("/gastos");

// updateExpense — lineas 34-46
const result = await service.updateExpense(id, parsed.data);
if (result.success) {
  revalidatePath("/gastos");
  revalidatePath(`/gastos/${id}`);
}
```

Las actions solo delegan y revalidan. No referencian directamente `orderId`. Sin embargo, si el gasto vinculado pasa a ser de un OrderItem (que vive bajo `/pedidos/[id]`), puede ser necesario revalidar tambien la ruta del pedido al crear/actualizar un gasto.

---

### 9. Componente ExpenseForm

**Archivo:** `src/components/expenses/ExpenseForm.tsx`

El formulario actualmente muestra un `<select>` para elegir un `Order` (lineas 204-218):

```tsx
// Campo de orden actual (lineas 204-218)
<select name="orderId" ...>
  <option value="none">Ninguno</option>
  {orders.map(order => (
    <option key={order.id} value={order.id}>Pedido #{order.orderNumber}</option>
  ))}
</select>
```

Las props del componente (`ExpenseFormProps`) reciben `orders: { id: string; orderNumber: number }[]` desde la pagina padre. Para cambiar a `OrderItem` se necesitaria recibir `orderItems` en lugar de (o ademas de) `orders`.

**Páginas que renderizan ExpenseForm:**
- `src/app/gastos/nuevo/page.tsx:5-16` — fetches `getOrders()` y pasa como prop
- `src/app/gastos/[id]/editar/page.tsx:12-38` — fetches `getOrders()` y `getExpense(id)` en paralelo

---

### 10. Como se muestran los gastos en el Detalle de Pedido

**Archivo:** `src/app/pedidos/[id]/page.tsx:194-224`

```tsx
// "Gastos Vinculados" section
{order.expenses.length > 0 && (
  <section>
    <h2>Gastos Vinculados</h2>
    {order.expenses.map(expense => (
      <div key={expense.id}>
        <span>{expense.category}</span>
        <span>{expense.description}</span>
        <span>{formatCurrency(expense.amount)}</span>
        <Link href={`/gastos/${expense.id}/editar`}>Editar</Link>
      </div>
    ))}
  </section>
)}
```

Estos gastos llegan via `order.expenses` (la relacion inversa en Order). Si se mueve a `OrderItem`, esta seccion no funcionaria igual — los gastos ya no estarian en `order.expenses` sino en `orderItem.expenses` para cada item.

---

### 11. Consulta del Detalle de Pedido (repo)

**Archivo:** `src/features/orders/orders.repo.ts:35-55`

```typescript
// findById include (linea 46)
include: {
  ...
  expenses: true,     // <-- trae gastos del pedido completo
  items: {
    include: {
      product: true,
      inventoryItem: true,
    }
  },
  ...
}
```

Si la relacion se mueve a `OrderItem`, este include debe cambiar a:
```typescript
items: {
  include: {
    product: true,
    inventoryItem: true,
    expenses: true,    // nuevo: gastos por item
  }
}
```
Y se debe eliminar (o mantener para gastos sin item) `expenses: true` del nivel de Order.

---

### 12. Dashboard (referencia a expenses)

**Archivo:** `src/features/dashboard/dashboard.repo.ts`

El dashboard consulta expenses para calcular totales financieros. Hace `prisma.expense.aggregate` y `prisma.expense.groupBy` filtrando por fecha. Estas consultas no usan `orderId` para filtrar, por lo que el cambio de `orderId` a `orderItemId` **no afecta directamente** el dashboard.

---

### 13. Tabla de Gastos (/gastos)

**Archivo:** `src/app/gastos/gastos-table.tsx`

La columna "Pedido" muestra actualmente:
```tsx
// Columna Pedido (lineas 82-91)
cell: (row) =>
  row.order
    ? <Link href={`/pedidos/${row.order.id}`}>#{row.order.orderNumber}</Link>
    : "---"
```

Si el gasto pasa a pertenecer a un `OrderItem`, el acceso al pedido seria indirecto:
`expense.orderItem.order.id` y `expense.orderItem.order.orderNumber`. El include del repo debe actualizarse.

---

### 14. Tipo ExpenseRow en GastosTable

**Archivo:** `src/app/gastos/gastos-table.tsx:9-21`

```typescript
interface ExpenseRow {
  ...
  order: { id: string; orderNumber: number } | null;   // <-- campo a cambiar
}
```

Este tipo local debe cambiar para reflejar la nueva relacion con `orderItem`.

---

## Code References

| Archivo | Linea(s) | Descripcion |
|---------|----------|-------------|
| `prisma/schema.prisma:128-146` | Expense model — campo `orderId` y relacion `order` |
| `prisma/schema.prisma:82` | Order model — inversa `expenses Expense[]` |
| `prisma/schema.prisma:93-109` | OrderItem model — sin relacion a Expense |
| `prisma/schema.prisma:214-218` | Enum CostSource — valor EXPENSES es informativo |
| `src/lib/validations/expense.ts:10` | Zod: `orderId: z.string().optional()...` |
| `src/features/expenses/expenses.repo.ts:4-34` | `findAll` — include `order` |
| `src/features/expenses/expenses.repo.ts:43-55` | `create` — pasa `orderId` directo |
| `src/features/expenses/expenses.service.ts:19-35` | `createExpense` — mapea `orderId || null` |
| `src/features/expenses/expenses.service.ts:37-54` | `updateExpense` — mapea `orderId || null` |
| `src/lib/actions/expenses.ts:23-31` | `createExpense` action |
| `src/lib/actions/expenses.ts:34-46` | `updateExpense` action |
| `src/components/expenses/ExpenseForm.tsx:204-218` | Select de Order en formulario |
| `src/app/gastos/nuevo/page.tsx:5-16` | Fetch de orders para el form |
| `src/app/gastos/[id]/editar/page.tsx:12-38` | Fetch de orders + expense para edit |
| `src/app/gastos/gastos-table.tsx:9-21` | Tipo `ExpenseRow` con `order` |
| `src/app/gastos/gastos-table.tsx:82-91` | Columna Pedido en tabla |
| `src/app/pedidos/[id]/page.tsx:194-224` | Seccion "Gastos Vinculados" en pedido |
| `src/features/orders/orders.repo.ts:46` | Include `expenses: true` en query del pedido |

---

## Architecture Insights

### Patron actual: Expense → Order (N:1 opcional)
```
Expense (N) ----orderId----> Order (1)
```
Un expense puede vincularse a un Order o no vincularse a nada.

### Estado que se quiere: Expense → OrderItem (N:1 opcional)
```
Expense (N) ----orderItemId----> OrderItem (1) ----orderId----> Order (1)
```
Un expense se vincularia a un item especifico, y el pedido se obtendria de forma indirecta via `orderItem.orderId`.

### Capas afectadas por el cambio

| Capa | Archivo | Cambio requerido |
|------|---------|-----------------|
| Schema | `prisma/schema.prisma` | Remover `orderId`/`order` de Expense, agregar `orderItemId`/`orderItem`; agregar inversa `expenses` en OrderItem; nueva migration |
| Zod | `src/lib/validations/expense.ts` | Cambiar `orderId` por `orderItemId` |
| Repo | `src/features/expenses/expenses.repo.ts` | Cambiar include `order` por `orderItem.order`; cambiar FK en create/update |
| Service | `src/features/expenses/expenses.service.ts` | Cambiar mapeo `orderId` → `orderItemId` |
| Actions | `src/lib/actions/expenses.ts` | Posiblemente revalidar `/pedidos/[id]` al crear/actualizar un gasto |
| Form | `src/components/expenses/ExpenseForm.tsx` | Cambiar select de Order por select de OrderItem (o cascada: seleccionar pedido → filtrar sus items) |
| Paginas Form | `src/app/gastos/nuevo/page.tsx` y `gastos/[id]/editar/page.tsx` | Cambiar fetch de `getOrders()` por fetch de `getOrderItems()` o equivalente |
| Tabla | `src/app/gastos/gastos-table.tsx` | Actualizar tipo `ExpenseRow` y columna "Pedido" para acceso indirecto |
| Detalle Pedido | `src/app/pedidos/[id]/page.tsx` | Cambiar `order.expenses` por iterar `order.items[].expenses` |
| Orders Repo | `src/features/orders/orders.repo.ts` | Cambiar include en `findById`: quitar `expenses: true`, agregar `expenses: true` dentro de cada item |

### Consideracion de UX del formulario
Actualmente el select muestra todos los pedidos. Si se cambia a OrderItem, el usuario necesitaria:
1. Seleccionar un pedido → luego ver los items de ese pedido y seleccionar uno
O bien:
2. Ir desde la pagina del pedido y agregar gastos directamente a un item desde ahi

Esto es una decision de flujo que el codebase actual no contempla.

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md` — Investigacion previa del modulo de rentals; documenta como `RentalCost` sigue un patron similar de costos opcionales asociados a una entidad (Rental), con tipos predefinidos en `RENTAL_COST_TYPES`.

---

## Related Research

- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md` — Analisis del modulo de rentals (patron comparable de costos asociados a una entidad)

---

## Open Questions

1. Si se cambia a `orderItemId`, ¿los gastos "generales" del negocio (sin orden) siguen siendo posibles? (`orderItemId` nullable = si)
2. ¿El formulario en `/gastos/nuevo` debe permitir seleccionar un item directamente, o los gastos por item se crean solo desde el detalle del pedido?
3. ¿Se debe mantener `Order.expenses` para gastos generales (sin item especifico) Y agregar `OrderItem.expenses` para gastos por item? ¿O se elimina completamente la relacion con Order?
4. ¿Hay datos existentes en `Expense.orderId` que necesiten migrarse a algun `orderItemId`?
5. ¿El dashboard sigue funcionando igual si `orderId` desaparece de Expense? (Si, ya que las queries del dashboard no filtran por `orderId`)
