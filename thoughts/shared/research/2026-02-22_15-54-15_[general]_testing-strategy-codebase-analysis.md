---
date: 2026-02-22T15:54:15Z
researcher: Claude
git_commit: 8aa781c3e37c7eae911973a4c45ed9d32123808b
branch: main
repository: dressDashboard
topic: "Análisis de áreas testables del codebase para agregar tests"
tags: [research, codebase, testing, services, validations, business-logic]
status: complete
last_updated: 2026-02-22
last_updated_by: Claude
---

# Research: Áreas Testables del Codebase

**Date**: 2026-02-22T15:54:15Z
**Researcher**: Claude
**Git Commit**: 8aa781c3e37c7eae911973a4c45ed9d32123808b
**Branch**: main
**Repository**: dressDashboard

## Research Question

Agregar tests en todo lo que se pueda para no romper cosas, ya que siempre tienen que pasar los tests para dejar un PR.

## Summary

El proyecto **no tiene infraestructura de testing** actualmente: no hay test runner (Jest/Vitest), no hay archivos de test, no hay CI/CD, y no hay dependencias de testing en `package.json`. Sin embargo, el codebase tiene una arquitectura en capas bien definida con múltiples áreas altamente testables, especialmente las funciones de lógica de negocio pura y los schemas de validación Zod.

## Estado Actual de Testing

| Categoría | Estado |
|---|---|
| Test runner (Jest/Vitest/Playwright) | No existe |
| Archivos de test (`*.test.ts`, `*.spec.ts`) | Ninguno |
| Directorios `__tests__` / `__mocks__` | Ninguno |
| Script `test` en `package.json` | No existe |
| Dependencias de testing | Ninguna |
| CI/CD (GitHub Actions) | No existe |
| Documentación de estrategia de testing | Ninguna |

## Detailed Findings

### 1. Funciones de Negocio Puras (Mayor Prioridad de Testing)

Estas funciones no tienen efectos secundarios, no requieren mocks, y contienen lógica financiera crítica.

#### `src/lib/business/status.ts`

- **`deriveStatusAfterPayment(currentStatus, totalPrice, minDownpaymentPct, newTotalPaid)`** → `OrderStatus`
  - Regla 1: `QUOTE` → `CONFIRMED` cuando `paidPct >= minDownpaymentPct`
  - Regla 2: `DELIVERED` → `COMPLETED` cuando `paidPct >= 100`
  - Guard: si `totalPrice === 0`, retorna `currentStatus` sin cambio
  - **Casos de test**: borde en 0%, justo debajo del mínimo, exacto al mínimo, 100%, más de 100%, totalPrice = 0

- **`canTransitionTo(currentStatus, targetStatus)`** → `boolean`
  - Basado en mapa estático `VALID_STATUS_TRANSITIONS`
  - **Casos de test**: todas las transiciones válidas (QUOTE→CONFIRMED, QUOTE→CANCELLED, etc.), transiciones inválidas, estados terminales (COMPLETED no puede transicionar)

- **`VALID_STATUS_TRANSITIONS`** — Mapa estático de transiciones:
  - QUOTE → [CONFIRMED, CANCELLED]
  - CONFIRMED → [IN_PROGRESS, CANCELLED]
  - IN_PROGRESS → [READY, CANCELLED]
  - READY → [DELIVERED, CANCELLED]
  - DELIVERED → [COMPLETED, CANCELLED]
  - COMPLETED → [] (terminal)
  - CANCELLED → [QUOTE] (reabrir)

#### `src/lib/business/profit.ts`

- **`calculateOrderProfit(order)`** → `number | null`
  - Retorna `null` si `order.status !== "COMPLETED"`
  - Retorna `totalPrice - totalCost` para pedidos completados
  - **Casos de test**: status no completado, status completado, valores Decimal de Prisma

- **`calculatePaidAmount(payments)`** → `number`
  - Suma todos los `amount` del array de pagos usando `toDecimalNumber`
  - **Casos de test**: array vacío (= 0), un pago, múltiples pagos, valores Decimal

- **`calculatePaidPercentage(payments, totalPrice)`** → `number`
  - Retorna `(paid / total) * 100`, con guard para `total === 0`
  - **Casos de test**: 0%, parcial, 100%, totalPrice = 0

#### `src/lib/utils.ts`

- **`toDecimalNumber(value: unknown)`** → `number`
  - Convierte Prisma Decimal, strings, numbers, null/undefined → number
  - **Casos de test**: null, undefined, 0, number directo, string numérico, string no numérico, objeto con toString()

- **`formatCurrency(value: any)`** → `string`
  - Formato COP (pesos colombianos) con Intl.NumberFormat
  - **Casos de test**: null, 0, enteros, decimales, strings numéricos

- **`formatDate(date)`** → `string`
  - Formato `dd/MM/yyyy` con locale español
  - **Casos de test**: Date object, string ISO, null, undefined

- **`formatDateTime(date)`** → `string`
  - Formato `dd/MM/yyyy HH:mm`
  - **Casos de test**: mismos que formatDate

---

### 2. Schemas de Validación Zod (Alta Prioridad)

Los schemas viven en `src/lib/validations/` y son testables como funciones puras (parse/safeParse).

| Archivo | Schemas | Tiene Refinements |
|---|---|---|
| `client.ts` | `clientSchema` | No |
| `category.ts` | `categorySchema` | No |
| `product.ts` | `productSchema` | No |
| `payment.ts` | `paymentSchema` | No |
| `expense.ts` | `expenseSchema` | No |
| `rental.ts` | `rentalSchema`, `rentalCostSchema` | No |
| `order.ts` | `orderItemSchema`, `orderSchema` | **Sí** (ambos) |

**Refinements críticos en `order.ts`:**
- `orderItemSchema`: si `itemType` es `SALE` o `RENTAL`, entonces `productId` es requerido
- `orderSchema`: si `adjustmentAmount !== 0`, entonces `adjustmentReason` es requerido

---

### 3. Lógica de Servicio con Computación Pura Inline (Prioridad Media)

Estas funciones en los servicios contienen lógica de cálculo que podría extraerse para testing, o testearse con mocks del repositorio.

#### `src/features/orders/orders.service.ts`

- **`updateOrderItem`** (líneas 104-132): Cálculo de descuentos y recálculo de totales
  - Lógica de descuento: FIXED (resta directa), PERCENTAGE (multiplicación), sin descuento
  - Recálculo: `newTotalPrice = sum(subtotals) + adjustmentAmount`
  - Recálculo: `newTotalCost = sum(quantity * costAmount)`

- **`deleteOrderItem`** (líneas 170-185): Misma lógica de descuento para items restantes

- **`updateOrderStatus`** (líneas 62-81): Usa `canTransitionTo` como gate

#### `src/features/payments/payments.service.ts`

- **`createPayment`** (líneas 31-52):
  - Guard de sobrepago: `newTotalPaid > totalPrice` → error
  - Derivación de estado: `deriveStatusAfterPayment(...)` para auto-transición

#### `src/features/rentals/rentals.service.ts`

- **`updateRental`** (líneas 53-58): Detección de primer retorno (`data.actualReturnDate && !rental.actualReturnDate`)
- **`createRental`** (línea 14): Guard de unicidad (un rental por orderItem)

---

### 4. Repositorios (Prioridad Baja para Unit Tests)

Los 9 repositorios (`*.repo.ts`) contienen exclusivamente queries Prisma. Son candidatos para **integration tests** con base de datos de test, no para unit tests con mocks.

| Feature | Repo |
|---|---|
| clients | `src/features/clients/clients.repo.ts` |
| dashboard | `src/features/dashboard/dashboard.repo.ts` |
| products | `src/features/products/products.repo.ts` |
| expenses | `src/features/expenses/expenses.repo.ts` |
| categories | `src/features/categories/categories.repo.ts` |
| payments | `src/features/payments/payments.repo.ts` |
| inventory | `src/features/inventory/inventory.repo.ts` |
| rentals | `src/features/rentals/rentals.repo.ts` |
| orders | `src/features/orders/orders.repo.ts` |

---

### 5. Server Actions (No Recomendado para Unit Tests)

Los 9 archivos en `src/lib/actions/` son thin adapters que llaman Zod + service + revalidatePath. Se testean mejor con E2E o integration tests.

---

### 6. Constantes

- `src/lib/constants/categories.ts` — Datos estáticos, testeable para asegurar estructura correcta

## Code References

- `src/lib/business/status.ts:4-25` — deriveStatusAfterPayment (transición automática por pago)
- `src/lib/business/status.ts:27-35` — VALID_STATUS_TRANSITIONS (mapa de transiciones)
- `src/lib/business/status.ts:37-42` — canTransitionTo (validación de transición)
- `src/lib/business/profit.ts:3-8` — calculateOrderProfit (ganancia de pedido)
- `src/lib/business/profit.ts:10-13` — calculatePaidAmount (suma de pagos)
- `src/lib/business/profit.ts:16-24` — calculatePaidPercentage (porcentaje pagado)
- `src/lib/utils.ts:34-38` — toDecimalNumber (conversión Prisma Decimal → number)
- `src/lib/utils.ts:11-19` — formatCurrency (formato COP)
- `src/lib/utils.ts:22-26` — formatDate (formato dd/MM/yyyy)
- `src/lib/utils.ts:28-32` — formatDateTime (formato dd/MM/yyyy HH:mm)
- `src/lib/validations/order.ts:17-25` — orderItemSchema refinement (productId requerido)
- `src/lib/validations/order.ts:40-43` — orderSchema refinement (adjustmentReason requerido)
- `src/features/orders/orders.service.ts:104-132` — updateOrderItem (cálculo descuentos/totales inline)
- `src/features/orders/orders.service.ts:170-185` — deleteOrderItem (recálculo totales inline)
- `src/features/payments/payments.service.ts:31-39` — createPayment (guard sobrepago)
- `src/features/payments/payments.service.ts:52` — createPayment (derivación automática de estado)
- `src/features/rentals/rentals.service.ts:53-58` — updateRental (detección primer retorno)

## Architecture Insights

### Estructura en capas actual (Actions → Services → Repos)

La arquitectura de 3 capas facilita el testing:
- **Capa 1 — Business Helpers** (`src/lib/business/`): Funciones puras sin I/O → unit tests directos
- **Capa 2 — Validations** (`src/lib/validations/`): Schemas Zod puros → unit tests con safeParse
- **Capa 3 — Services** (`src/features/*/`): Orquestación con repos → unit tests con mocks de repos
- **Capa 4 — Repos** (`src/features/*/`): Queries Prisma → integration tests con DB de test
- **Capa 5 — Actions** (`src/lib/actions/`): Thin adapters → E2E tests

### Dependencia clave

`toDecimalNumber` en `utils.ts:34` es la función base que todas las funciones financieras usan para convertir Prisma `Decimal` a `number`. Es el punto más crítico a testear primero.

### Computación duplicada

La lógica de cálculo de descuentos (FIXED/PERCENTAGE) aparece duplicada en:
- `orders.service.ts:104-111` (updateOrderItem)
- `orders.service.ts:173-183` (deleteOrderItem)

Ambas instancias comparten el mismo patrón y deberían cubrirse con los mismos casos de test.

## Historical Context (from thoughts/)

No se encontraron documentos previos sobre testing, CI/CD, o estrategia de calidad en el directorio `thoughts/`.

## Related Research

No hay documentos de research previos relacionados con testing.

## Mapa de Prioridades de Testing

| Prioridad | Área | Tipo de Test | Requiere Mocks | Archivos |
|---|---|---|---|---|
| 1 (Crítica) | Business helpers | Unit | No | `status.ts`, `profit.ts` |
| 2 (Crítica) | Utils | Unit | No | `utils.ts` |
| 3 (Alta) | Validaciones Zod | Unit | No | 7 archivos en `validations/` |
| 4 (Media) | Services (lógica) | Unit | Sí (repos) | `orders.service.ts`, `payments.service.ts`, `rentals.service.ts` |
| 5 (Baja) | Repos | Integration | DB test | 9 archivos `*.repo.ts` |
| 6 (Baja) | Actions | E2E | Full stack | 9 archivos en `actions/` |

## Open Questions

1. **Test runner**: ¿Vitest o Jest? Vitest es más moderno y rápido con ESM/TypeScript nativo; Jest es más maduro y tiene mayor ecosistema.
2. **Coverage mínimo**: ¿Qué porcentaje de cobertura se quiere enforcer en CI?
3. **Integration tests**: ¿Se quiere usar una base de datos de test separada para tests de repositorio?
4. **E2E tests**: ¿Se necesitan tests E2E con Playwright para los flujos de UI?
5. **CI/CD**: ¿Se va a configurar GitHub Actions para correr tests en PRs?
