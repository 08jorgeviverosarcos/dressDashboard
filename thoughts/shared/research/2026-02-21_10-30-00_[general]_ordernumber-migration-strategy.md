---
date: 2026-02-21T10:30:00-06:00
researcher: Claude
git_commit: e813c60b0567d0b00a8110c299b6e7658284df28
branch: main
repository: dressDashboard
topic: "orderNumber: cómo funciona actualmente y opciones para migración desde facturas físicas"
tags: [research, codebase, orders, orderNumber, migration]
status: complete
last_updated: 2026-02-21
last_updated_by: Claude
last_updated_note: "Preguntas abiertas resueltas — decisión final documentada"
---

# Research: orderNumber — Estado Actual y Contexto para Migración

**Date**: 2026-02-21T10:30:00-06:00
**Researcher**: Claude
**Git Commit**: e813c60b0567d0b00a8110c299b6e7658284df28
**Branch**: main
**Repository**: dressDashboard

## Research Question

El usuario necesita entender cómo funciona `orderNumber` actualmente para planificar una migración suave desde facturas físicas al sistema digital. Dos opciones evaluadas:
1. Agregar un campo `manualOrderId` temporal
2. Hacer que `orderNumber` sea manual ahora y automático después

## Summary

`orderNumber` es actualmente un `Int @unique @default(autoincrement())` — un `SERIAL` en PostgreSQL. **Nunca** aparece en formularios, esquemas Zod, actions ni services. Es 100% generado por la base de datos al insertar una fila. Se usa en **16+ ubicaciones de UI** exclusivamente para mostrar `#N` y en **2 filtros de búsqueda** (pedidos y pagos).

## Detailed Findings

### 1. Definición en Prisma Schema

**`prisma/schema.prisma:69`**
```prisma
orderNumber       Int         @unique @default(autoincrement())
```

Traducido a SQL en la migración inicial:
- `prisma/migrations/20260217163331_init/migration.sql:75` → `"orderNumber" SERIAL NOT NULL`
- `prisma/migrations/20260217163331_init/migration.sql:190` → `CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");`

### 2. Flujo de Creación — orderNumber NO participa

El flujo completo de creación es:

```
OrderForm (client) → createOrder action → orderSchema Zod → service.createOrder → repo.create → prisma.order.create
```

**En ningún paso se pasa `orderNumber`:**

| Capa | Archivo | ¿Incluye orderNumber? |
|------|---------|----------------------|
| Formulario | `src/components/orders/OrderForm.tsx` | NO — no hay campo de UI |
| Tipo OrderFormData | `src/lib/validations/order.ts:44` | NO — derivado de orderSchema que no lo incluye |
| Zod Schema | `src/lib/validations/order.ts:27-42` | NO |
| Action | `src/lib/actions/orders.ts:20-28` | NO — recibe OrderFormData |
| Service | `src/features/orders/orders.service.ts:17-48` | NO — destructura `{ items, ...orderData }` |
| Tipo OrderData | `src/features/orders/orders.repo.ts:5-16` | NO |
| Repo create() | `src/features/orders/orders.repo.ts:63-98` | NO — el data de prisma.order.create no incluye orderNumber |
| PostgreSQL | SERIAL sequence | SÍ — lo genera automáticamente |

### 3. Todos los Lugares Donde se LEE/MUESTRA orderNumber

#### Pedidos
| Archivo | Línea | Uso |
|---------|-------|-----|
| `src/app/pedidos/orders-table.tsx` | 20, 68 | Tipo + celda de tabla: `#{row.orderNumber}` |
| `src/app/pedidos/[id]/page.tsx` | 36 | Header: `Pedido #${order.orderNumber}` |
| `src/app/pedidos/[id]/editar/page.tsx` | 25 | Header: `Editar Pedido #${order.orderNumber}` |
| `src/app/pedidos/[id]/items/[itemId]/page.tsx` | 41 | Descripción: `Pedido #${item.order.orderNumber}` |
| `src/app/pedidos/[id]/items/[itemId]/editar/page.tsx` | 25 | Descripción: `Pedido #${item.order.orderNumber}` |

#### Dashboard
| Archivo | Línea | Uso |
|---------|-------|-----|
| `src/app/page.tsx` | 133 | Eventos próximos: `#{event.orderNumber}` |
| `src/app/page.tsx` | 164 | Pagos recientes: `#{payment.order.orderNumber}` |

#### Pagos
| Archivo | Línea | Uso |
|---------|-------|-----|
| `src/app/pagos/payments-table.tsx` | 28, 87 | Tipo + celda: `#{row.order.orderNumber}` |
| `src/app/pagos/[id]/page.tsx` | 63 | Detalle: `#{payment.order.orderNumber}` |

#### Gastos
| Archivo | Línea | Uso |
|---------|-------|-----|
| `src/app/gastos/gastos-table.tsx` | 31, 85 | Tipo + celda: `#{row.orderItem.order.orderNumber}` |
| `src/app/gastos/[id]/page.tsx` | 76 | Detalle del gasto |
| `src/app/gastos/[id]/editar/page.tsx` | 24 | Map para form |
| `src/app/gastos/nuevo/page.tsx` | 14 | Map para form |
| `src/components/expenses/ExpenseForm.tsx` | 34, 233 | Tipo + dropdown: `Pedido #{o.orderNumber}` |

#### Clientes / Productos
| Archivo | Línea | Uso |
|---------|-------|-----|
| `src/app/clientes/[id]/page.tsx` | 98 | Tabla de pedidos del cliente |
| `src/app/productos/[id]/page.tsx` | 120 | Tabla de items del producto |

### 4. Filtros de Búsqueda

- **`src/features/orders/orders.repo.ts:25`** — `{ orderNumber: { equals: parseInt(filters.search) || -1 } }`
- **`src/features/payments/payments.repo.ts:25`** — `{ order: { orderNumber: { equals: asNumber } } }`

### 5. Repos que Seleccionan orderNumber

- `src/features/orders/orders.repo.ts:238` — `select: { orderNumber: true }` en findOrderItemById
- `src/features/expenses/expenses.repo.ts:10` — `order: { select: { id: true, orderNumber: true } }`
- Queries con `include` completo (findAll, findById, etc.) traen orderNumber implícitamente

## Architecture Insights

### Patrón Actual
- `orderNumber` es **read-only desde la aplicación**
- PostgreSQL maneja la secuencia completamente
- La secuencia arranca desde 1 y se incrementa (comportamiento `SERIAL` estándar)
- Todos los displays usan el formato `#N`
- No existe concepto de "número de factura manual" en el sistema actual

### Impacto de Cada Opción de Migración

**Opción A: Agregar `manualOrderId` temporal**
- Requiere nuevo campo en schema
- Requiere migración
- Requiere modificar **todas** las ubicaciones de display (16+) para mostrar `manualOrderId ?? orderNumber`
- Requiere modificar OrderForm para aceptar el campo
- Después de migración: eliminar campo y otra migración
- orderNumber sigue auto-incrementando en paralelo

**Opción B: Hacer `orderNumber` manual (quitar autoincrement)**
- Requiere cambiar schema: `Int @unique` sin `@default(autoincrement())`
- Requiere DROP del SERIAL/sequence en PostgreSQL
- Requiere agregar `orderNumber` al formulario, Zod schema, OrderFormData, OrderData, repo.create
- TODOS los displays ya leen `orderNumber` → no hay cambios de UI en display
- Búsqueda ya funciona con `orderNumber`
- Después de migración: volver a agregar `@default(autoincrement())` con la secuencia ajustada al último número

## Code References

- `prisma/schema.prisma:69` — Definición de orderNumber
- `prisma/migrations/20260217163331_init/migration.sql:75,190` — SQL SERIAL + unique index
- `src/features/orders/orders.repo.ts:5-16` — OrderData type (sin orderNumber)
- `src/features/orders/orders.repo.ts:63-98` — create() sin orderNumber
- `src/features/orders/orders.repo.ts:25` — Búsqueda por orderNumber
- `src/lib/validations/order.ts:27-42` — orderSchema sin orderNumber
- `src/components/orders/OrderForm.tsx` — Formulario sin campo orderNumber

## Historical Context

- No se encontraron documentos previos en `thoughts/` sobre orderNumber o migración de facturas físicas
- El sistema fue creado con la migración inicial `20260217163331_init` con SERIAL desde el inicio

## Open Questions

_Todas resueltas._

## Follow-up Research 2026-02-21 — Decisión Final

### Respuestas del Usuario
- **Formato de números**: consecutivos enteros (no alfanumérico)
- **Número actual**: ~470
- **Duración de fase manual**: ~2 meses

### Decisión: Opción B confirmada

Con estos datos la **Opción B es la correcta**:

- Los números son enteros consecutivos → encajan perfectamente en `Int`
- El sistema ya tiene `orderNumber` como `Int`, solo hay que quitar el `@default(autoincrement())`
- 2 meses es tiempo acotado → la complejidad temporal es baja
- Al finalizar la fase manual, se ajusta la secuencia de PostgreSQL a `max(orderNumber) + 1` y se restaura el autoincrement

### Cambios Necesarios — Fase 1 (Manual, AHORA)

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma:69` | `Int @unique` (quitar `@default(autoincrement())`) |
| `prisma/migrations/...` | `ALTER TABLE "Order" ALTER COLUMN "orderNumber" DROP DEFAULT` |
| `src/lib/validations/order.ts` | Agregar `orderNumber: z.number().int().min(1)` a `orderSchema` |
| `src/features/orders/orders.repo.ts` | Agregar `orderNumber: number` a `OrderData` type |
| `src/features/orders/orders.repo.ts` | Agregar `orderNumber: orderData.orderNumber` a `prisma.order.create()` |
| `src/features/orders/orders.repo.ts` | NO incluir `orderNumber` en `updateInTransaction` (campo inmutable post-creación) |
| `src/components/orders/OrderForm.tsx` | Agregar campo `orderNumber` (requerido en create, display en edit) |

**Sin tocar**: Las 16+ ubicaciones de display (`#${order.orderNumber}`), los filtros de búsqueda, ni ninguna otra capa.

### Cambios Necesarios — Fase 2 (Automático, ~2 meses después)

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma:69` | Restaurar `@default(autoincrement())` |
| Migration | `CREATE SEQUENCE` starting at `max(orderNumber)+1`, `SET DEFAULT nextval(...)` |
| `src/lib/validations/order.ts` | Eliminar `orderNumber` de `orderSchema` |
| `src/features/orders/orders.repo.ts` | Eliminar `orderNumber` de `OrderData` y de `prisma.order.create()` |
| `src/components/orders/OrderForm.tsx` | Eliminar campo `orderNumber` del formulario |
