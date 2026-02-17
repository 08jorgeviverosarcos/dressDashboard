# Análisis de Server Actions

> Análisis estático de `src/lib/actions/` — clasificación, dependencias y orden de refactor recomendado.

---

## `categories.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getCategories` | READ | Sin filtros, query simple |
| `getCategory` | READ | Include de productos activos |
| `createCategory` | WRITE | Zod + uniqueness check en `code` |
| `updateCategory` | WRITE | Zod + uniqueness check excluyendo self |
| `deleteCategory` | WRITE | Guard: bloquea si tiene productos activos |

**Orden de refactor:** Primero. Módulo completamente aislado, sin dependencias externas, patrón limpio y consistente.

---

## `clients.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getClients` | READ | Filtro de búsqueda opcional con OR |
| `getClient` | READ | Include de órdenes + pagos |
| `createClient` | WRITE | Zod + create |
| `updateClient` | WRITE | Zod + update, invalida 2 paths |
| `deleteClient` | WRITE | Guard: bloquea si tiene órdenes |

**Orden de refactor:** Segundo. También aislado, sin lógica de negocio, patrón idéntico a `categories`.

---

## `products.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getProducts` | READ | `where` tipado como `Record<string, unknown>` — pierde type safety de Prisma |
| `getProduct` | READ | Include profundo: category + inventoryItems + orderItems → order → client |
| `createProduct` | WRITE | Zod + uniqueness check en `code` + `connect` para relación category |
| `updateProduct` | WRITE | Zod + uniqueness check + `connect`/`disconnect` para category |

**Orden de refactor:** Tercero. Aislado, pero `getProducts` tiene un problema: el `where: Record<string, unknown>` hace que el filtro de `categoryId` no esté tipado. Candidato a tipar con `Prisma.ProductWhereInput`.

---

## `inventory.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getInventoryItems` | READ | `where` tipado como `Record<string, unknown>`, búsqueda anidada en `product` |
| `createInventoryItem` | WRITE | **Sin Zod** — valida solo `productId` manualmente, inconsistente con el resto |
| `updateInventoryStatus` | WRITE | Actualización de un solo campo |
| `updateInventoryItem` | WRITE | Actualización parcial con spread condicional |
| `deleteInventoryItem` | WRITE | Guard: bloquea si está vinculado a `OrderItem` |

**Orden de refactor:** Cuarto. Sin dependencias externas, pero `createInventoryItem` es el único WRITE de toda la app que no usa Zod. También tiene dos funciones de update que hacen cosas solapadas (`updateInventoryStatus` es un subconjunto de `updateInventoryItem`).

---

## `expenses.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getExpenses` | READ | Filtros dinámicos: categoría, tipo, búsqueda, rango de fechas |
| `getExpense` | READ | Simple, include de orden |
| `createExpense` | WRITE | Zod + create, link opcional a `orderId` |
| `updateExpense` | WRITE | Zod + update |
| `deleteExpense` | WRITE | **Sin guard** — elimina directamente aunque el gasto esté vinculado a un pedido |

**Orden de refactor:** Quinto. Casi idéntico a `clients`, pero `deleteExpense` es el único DELETE sin protección en toda la app — todos los demás verifican dependencias antes de eliminar.

---

## `payments.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getPayments` | READ | Filtros de fecha, método y orderId |
| `createPayment` | WRITE + BUSINESS LOGIC HEAVY | Ver detalle abajo |
| `deletePayment` | WRITE | Fetch + delete. **No revierte el status del pedido** |

**`createPayment` en detalle** — la función más compleja del codebase:
1. Zod + fetch de orden con pagos existentes
2. Calcula monto pagado con `calculatePaidAmount()` (`profit.ts`)
3. Valida que el nuevo total no supere `totalPrice`
4. Crea el pago
5. Llama a `deriveStatusAfterPayment()` (`status.ts`) para calcular si el status debe avanzar
6. Si cambia: `$transaction` con `Order.update` + `AuditLog.create`
7. `AuditLog.create` adicional para el pago mismo
8. Invalida 3 paths

**Dependencias externas:** `profit.ts` (`calculatePaidAmount`), `status.ts` (`deriveStatusAfterPayment`), `utils.ts` (`toDecimalNumber`)

**Orden de refactor:** Sexto. No refactorizar hasta haber validado bien `profit.ts` y `status.ts`. El `deletePayment` tiene un gap conceptual: no recalcula ni revierte el status del pedido al borrar un pago.

---

## `rentals.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getRental` | READ | Include muy profundo: costs + order + client + items + product + inventoryItem |
| `createRental` | WRITE | **Sin Zod** — usa tipado inline, inconsistente con el resto |
| `updateRental` | WRITE + BUSINESS LOGIC | Side effect sobre inventario — ver detalle abajo |
| `addRentalCost` | WRITE | Zod + existence check + create |
| `deleteRentalCost` | WRITE | Fetch para obtener `orderId` + delete |

**`updateRental` en detalle** — tiene side effects no obvios:
- Si se está estableciendo `actualReturnDate` por primera vez, itera sobre todos los `OrderItem` del pedido y por cada uno que tenga `inventoryItem` asociado: incrementa `usageCount` y cambia `status` a `AVAILABLE`
- Es decir: `updateRental` escribe en `InventoryItem` directamente — cruza el dominio de `inventory.ts`

**Dependencias cruzadas:** escribe en `InventoryItem` (dominio de `inventory.ts`)

**Orden de refactor:** Séptimo. Los side effects sobre inventario son el mayor riesgo. `createRental` sin Zod es inconsistencia secundaria.

---

## `orders.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getOrders` | READ | `parseInt(filters.search) \|\| -1` para buscar por número de orden |
| `getOrder` | READ | Include más profundo de la app: todas las relaciones |
| `createOrder` | WRITE + BUSINESS LOGIC | Nested create de items + AuditLog |
| `updateOrder` | WRITE + BUSINESS LOGIC | `$transaction`: delete-all-items + recreate. **No genera AuditLog** |
| `updateOrderStatus` | WRITE + BUSINESS LOGIC | Valida transición con `canTransitionTo()` + `$transaction` con AuditLog |

**Asimetría en AuditLog:** `createOrder` y `updateOrderStatus` crean AuditLog, pero `updateOrder` (editar items/precios) no. Si se edita un pedido, no hay rastro en el historial.

**Dependencias externas:** `status.ts` (`canTransitionTo`)

**Orden de refactor:** Octavo. El más acoplado: `createPayment` escribe en el dominio de orders (status), `updateRental` escribe en el dominio de inventory. Cualquier cambio aquí puede romper flujos en `payments.ts` y `rentals.ts`.

---

## `dashboard.ts`

| Función | Clasificación | Notas |
|---|---|---|
| `getDashboardData` | READ + BUSINESS LOGIC HEAVY | 8 queries paralelas + `getMonthlyTrends` interno |
| `getMonthlyTrends` *(privada)* | READ + BUSINESS LOGIC | Loop de 6 iteraciones, cada una con 2 queries paralelas (12 queries total, secuenciales entre meses) |
| `getTopProducts` | READ + BUSINESS LOGIC | `groupBy` + segundo fetch + merge manual |

**Notas:**
- `getMonthlyTrends` no está exportada — solo la usa `getDashboardData` internamente
- El loop de 6 meses en `getMonthlyTrends` hace las queries secuencialmente entre meses (no se pueden paralelizar porque dependen del índice `i`), pero sí paralelas dentro de cada mes
- `getTopProducts` hace dos queries separadas en vez de un `include` — el merge manual con `.find()` es O(n×m)

**Dependencias externas:** `utils.ts` (`toDecimalNumber`)

**Orden de refactor:** Último. No tiene writes, pero agrega datos de todos los dominios. Los cambios en cualquier otro módulo pueden requerir ajustes aquí.

---

## Mapa de dependencias entre módulos

```
payments.ts  ──── lee ──────────────────▶  orders.ts (Order + payments)
             ──── escribe (status) ──────▶  orders.ts (Order.status)
             ──── escribe (audit) ────────▶  orders.ts (AuditLog)
             ──── usa ────────────────────▶  profit.ts (calculatePaidAmount)
             ──── usa ────────────────────▶  status.ts (deriveStatusAfterPayment)

orders.ts    ──── usa ────────────────────▶  status.ts (canTransitionTo)
             ──── escribe (audit) ────────▶  AuditLog

rentals.ts   ──── escribe (uso/estado) ──▶  inventory.ts (InventoryItem)

expenses.ts  ──── link opcional ─────────▶  orders.ts (orderId)

dashboard.ts ──── lee ──────────────────▶  todos los dominios
```

**Módulos completamente aislados** (sin dependencias cruzadas):
- `categories.ts`
- `clients.ts`
- `products.ts`
- `inventory.ts`

---

## Gaps identificados

| # | Módulo | Función | Problema |
|---|---|---|---|
| 1 | `products.ts` | `getProducts` | `where: Record<string, unknown>` pierde type safety |
| 2 | `inventory.ts` | `getInventoryItems` | `where: Record<string, unknown>` pierde type safety |
| 3 | `inventory.ts` | `createInventoryItem` | Sin Zod — único WRITE sin validación de schema |
| 4 | `inventory.ts` | `updateInventoryStatus` | Subconjunto de `updateInventoryItem` — funciones solapadas |
| 5 | `expenses.ts` | `deleteExpense` | Sin guard — único DELETE sin verificar dependencias |
| 6 | `payments.ts` | `deletePayment` | No recalcula ni revierte el status del pedido |
| 7 | `rentals.ts` | `createRental` | Sin Zod — tipado inline inconsistente |
| 8 | `rentals.ts` | `updateRental` | Side effect sobre `InventoryItem` no es obvio desde la firma |
| 9 | `orders.ts` | `updateOrder` | No genera AuditLog — asimetría con `createOrder` y `updateOrderStatus` |
| 10 | `dashboard.ts` | `getMonthlyTrends` | 6 iteraciones secuenciales con 2 queries c/u — no totalmente paralelo |
| 11 | `dashboard.ts` | `getTopProducts` | Merge manual O(n×m) en vez de query relacional |

---

## Orden de refactor recomendado

| Prioridad | Módulo | Razón |
|---|---|---|
| 1 | `categories.ts` | Completamente aislado, patrón más limpio |
| 2 | `clients.ts` | Aislado, patrón idéntico a categories |
| 3 | `products.ts` | Aislado, solo el `where` sin tipos es el riesgo |
| 4 | `expenses.ts` | Casi aislado, `deleteExpense` sin guard es el único gap |
| 5 | `inventory.ts` | Sin Zod en create, dos updates solapados |
| 6 | `payments.ts` | Lógica de negocio alta, depende de `profit.ts` y `status.ts` |
| 7 | `rentals.ts` | Side effects cruzados sobre inventario |
| 8 | `orders.ts` | Más acoplado, transacciones, gaps en AuditLog |
| 9 | `dashboard.ts` | Sin writes, pero depende de todos los dominios |
