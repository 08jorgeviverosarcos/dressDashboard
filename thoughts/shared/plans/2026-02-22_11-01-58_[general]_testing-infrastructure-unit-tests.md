# Testing Infrastructure + Unit Tests Implementation Plan

## Overview

Agregar infraestructura de testing con Vitest al proyecto y escribir unit tests para todas las funciones puras (business helpers, utils) y schemas de validación Zod. El objetivo es proteger contra regresiones en PRs.

## Current State Analysis

- **Cero infraestructura de testing**: no hay test runner, archivos de test, dependencias, ni scripts
- El proyecto tiene una arquitectura en capas bien definida con funciones puras separadas de I/O
- 3 funciones de negocio en `src/lib/business/` (status.ts, profit.ts)
- 4 funciones de utilidad en `src/lib/utils.ts`
- 9 schemas Zod en 7 archivos de `src/lib/validations/`
- Path alias `@/*` en tsconfig que Vitest necesita resolver
- TypeScript strict + ESM modules

## Desired End State

- Vitest instalado y configurado con resolución de path aliases
- Script `test` en package.json que ejecuta `vitest run`
- Unit tests para todas las funciones puras en `src/lib/business/` y `src/lib/utils.ts`
- Unit tests para todos los 9 schemas Zod en `src/lib/validations/`
- Todos los tests pasan con `npm test`

### Verificación:
```bash
npm test
# Debe mostrar todos los tests pasando sin errores
```

## What We're NOT Doing

- NO tests de servicios (requieren mocks de repos)
- NO tests de repositorios (requieren DB de test)
- NO tests E2E/integration
- NO CI/CD con GitHub Actions (se puede agregar después)
- NO configuración de coverage mínimo
- NO mocks de ningún tipo
- NO cambios en código existente

## Implementation Approach

Vitest con configuración mínima. Archivos de test co-ubicados junto a los archivos fuente con sufijo `.test.ts`. Solo funciones puras — sin mocks, sin I/O.

---

## Phase 1: Configurar Vitest

### Overview
Instalar Vitest y configurarlo para resolver path aliases de TypeScript.

### Changes Required:

#### 1. Instalar Vitest
```bash
npm install -D vitest
```

#### 2. Crear `vitest.config.ts` en la raíz del proyecto
**File**: `vitest.config.ts` (nuevo)

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

#### 3. Agregar script `test` en package.json
**File**: `package.json`
**Changes**: Agregar `"test": "vitest run"` al objeto `scripts`

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "db:migrate": "npx prisma migrate dev",
  "db:seed": "npx prisma db seed",
  "db:studio": "npx prisma studio",
  "db:reset": "npx prisma migrate reset"
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm test` ejecuta sin errores (0 tests encontrados pero sin crash): `npm test`
- [ ] vitest.config.ts existe y es válido

#### Manual Verification:
- [ ] Confirmar que `npm test` muestra output de Vitest sin errores

**Implementation Note**: Pausar aquí para confirmar que Vitest corre correctamente antes de escribir tests.

---

## Phase 2: Tests de Utils (`src/lib/utils.ts`)

### Overview
Tests para `toDecimalNumber`, `formatCurrency`, `formatDate`, y `formatDateTime`. `toDecimalNumber` es la base de todos los cálculos financieros.

### Changes Required:

#### 1. Crear archivo de test
**File**: `src/lib/utils.test.ts` (nuevo)

Tests a escribir:

**`toDecimalNumber`** — 7 casos:
- `null` → `0`
- `undefined` → `0`
- `0` → `0`
- número directo (ej. `1500.50`) → `1500.50`
- string numérico (`"1500.50"`) → `1500.50`
- string no numérico (`"abc"`) → `0`
- objeto con toString (`{ toString: () => "250.00" }`) → `250` (simula Prisma Decimal)

**`formatCurrency`** — 5 casos:
- `null` → `"$0"`
- `0` → resultado con formato COP
- número entero (ej. `1500000`) → formato COP con separadores de miles
- string numérico (`"250000"`) → formato COP
- número negativo → formato COP con signo

**`formatDate`** — 4 casos:
- `null` → `""`
- `undefined` → `""`
- `new Date("2026-02-22T10:00:00Z")` → `"22/02/2026"`
- string ISO `"2026-02-22T10:00:00Z"` → `"22/02/2026"`

**`formatDateTime`** — 3 casos:
- `null` → `""`
- `new Date("2026-02-22T10:30:00")` → contiene `"22/02/2026"` y `"10:30"`
- string ISO → formato con fecha y hora

**Nota**: NO testear `cn()` — es un wrapper directo de clsx+twMerge, no contiene lógica propia.

### Success Criteria:

#### Automated Verification:
- [ ] `npm test` pasa todos los tests de utils: `npm test`

#### Manual Verification:
- [ ] Revisar que los tests cubren los edge cases de Prisma Decimal (objeto con toString)

**Implementation Note**: Pausar aquí para confirmar que todos los tests de utils pasan.

---

## Phase 3: Tests de Business Helpers (`src/lib/business/`)

### Overview
Tests para las funciones de lógica de negocio: transiciones de estado y cálculos financieros.

### Changes Required:

#### 1. Tests de status
**File**: `src/lib/business/status.test.ts` (nuevo)

**`canTransitionTo`** — Tests exhaustivos:
- Todas las transiciones válidas (12 total):
  - QUOTE → CONFIRMED ✓
  - QUOTE → CANCELLED ✓
  - CONFIRMED → IN_PROGRESS ✓
  - CONFIRMED → CANCELLED ✓
  - IN_PROGRESS → READY ✓
  - IN_PROGRESS → CANCELLED ✓
  - READY → DELIVERED ✓
  - READY → CANCELLED ✓
  - DELIVERED → COMPLETED ✓
  - DELIVERED → CANCELLED ✓
  - CANCELLED → QUOTE ✓
- Transiciones inválidas:
  - QUOTE → DELIVERED → `false`
  - COMPLETED → QUOTE → `false` (terminal)
  - COMPLETED → CANCELLED → `false` (terminal)
  - CONFIRMED → QUOTE → `false` (no retrocede)

**`deriveStatusAfterPayment`** — 8 casos:
- totalPrice = 0 → retorna currentStatus sin cambio
- QUOTE + paidPct < minPct → mantiene QUOTE
- QUOTE + paidPct === minPct (borde exacto) → CONFIRMED
- QUOTE + paidPct > minPct → CONFIRMED
- CONFIRMED + paidPct >= 100 → mantiene CONFIRMED (solo DELIVERED transiciona)
- DELIVERED + paidPct < 100 → mantiene DELIVERED
- DELIVERED + paidPct === 100 → COMPLETED
- DELIVERED + paidPct > 100 → COMPLETED

#### 2. Tests de profit
**File**: `src/lib/business/profit.test.ts` (nuevo)

**`calculateOrderProfit`** — 4 casos:
- status !== "COMPLETED" (ej. "QUOTE") → `null`
- status === "COMPLETED", totalPrice 1000, totalCost 600 → `400`
- status === "COMPLETED", totalPrice y totalCost como objetos con toString (simula Prisma Decimal) → cálculo correcto
- status === "COMPLETED", totalCost > totalPrice → número negativo (pérdida)

**`calculatePaidAmount`** — 4 casos:
- array vacío → `0`
- un pago: `[{ amount: 500 }]` → `500`
- múltiples pagos: `[{ amount: 300 }, { amount: 200 }]` → `500`
- pagos con objetos Decimal (toString): `[{ amount: { toString: () => "1000" } }]` → `1000`

**`calculatePaidPercentage`** — 4 casos:
- totalPrice = 0 → `0`
- pagos que cubren 50% → `50`
- pagos que cubren 100% → `100`
- sin pagos → `0`

### Success Criteria:

#### Automated Verification:
- [ ] `npm test` pasa todos los tests de status y profit: `npm test`

#### Manual Verification:
- [ ] Revisar que los tests de `deriveStatusAfterPayment` cubren los bordes exactos del porcentaje mínimo

**Implementation Note**: Pausar aquí para confirmar que todos los tests de business pasan.

---

## Phase 4: Tests de Validaciones Zod (`src/lib/validations/`)

### Overview
Tests para los 9 schemas Zod en 7 archivos. Usar `safeParse` para verificar tanto datos válidos como inválidos.

### Changes Required:

#### 1. Tests de client
**File**: `src/lib/validations/client.test.ts` (nuevo)

- Datos válidos mínimos: `{ name: "Test" }` → success
- name vacío → error "El nombre es requerido"
- email inválido → error "Email inválido"
- Campos opcionales vacíos ("") → success

#### 2. Tests de category
**File**: `src/lib/validations/category.test.ts` (nuevo)

- Datos válidos: `{ name: "Test", code: "TST" }` → success
- name vacío → error
- code vacío → error

#### 3. Tests de product
**File**: `src/lib/validations/product.test.ts` (nuevo)

- Datos válidos mínimos con type SALE → success
- code vacío → error
- name vacío → error
- salePrice negativo → error "El precio debe ser positivo"
- type inválido → error
- categoryId null → success (opcional)

#### 4. Tests de payment
**File**: `src/lib/validations/payment.test.ts` (nuevo)

- Datos válidos completos → success
- amount = 0 → error "El monto debe ser mayor a 0"
- amount negativo → error
- paymentType inválido → error
- paymentMethod inválido → error
- orderId vacío → error

#### 5. Tests de expense
**File**: `src/lib/validations/expense.test.ts` (nuevo)

- Datos válidos completos → success
- amount = 0 → error
- description vacío → error
- category vacío → error
- orderItemId null → success (opcional)

#### 6. Tests de rental
**File**: `src/lib/validations/rental.test.ts` (nuevo)

**rentalSchema:**
- Datos válidos mínimos → success
- orderItemId vacío → error
- deposit default 0 → success
- returnDate null → success

**rentalCostSchema:**
- Datos válidos → success
- amount = 0 → error
- rentalId vacío → error
- type vacío → error

#### 7. Tests de order (MAS IMPORTANTE — tiene refinements)
**File**: `src/lib/validations/order.test.ts` (nuevo)

**orderItemSchema:**
- Item tipo SALE con productId → success
- Item tipo RENTAL con productId → success
- Item tipo SERVICE sin productId → success
- Item tipo SALE sin productId → error "Seleccione un producto" (refinement)
- Item tipo RENTAL sin productId → error "Seleccione un producto" (refinement)
- quantity = 0 → error "Cantidad mínima: 1"
- unitPrice negativo → error

**orderSchema:**
- Order válida con 1 item → success
- items array vacío → error "Agregue al menos un item"
- adjustmentAmount !== 0 con adjustmentReason → success
- adjustmentAmount !== 0 sin adjustmentReason → error "Ingrese el motivo del ajuste" (refinement)
- adjustmentAmount = 0 sin adjustmentReason → success (no requiere razón)
- orderNumber = 0 → error
- clientId vacío → error
- minDownpaymentPct default 30 → success
- minDownpaymentPct > 100 → error

### Success Criteria:

#### Automated Verification:
- [ ] `npm test` pasa TODOS los tests (utils + business + validations): `npm test`

#### Manual Verification:
- [ ] Revisar que los refinements de order.ts están cubiertos (productId requerido para SALE/RENTAL, adjustmentReason requerido si adjustmentAmount !== 0)

**Implementation Note**: Pausar aquí. Todos los tests deben pasar con `npm test`.

---

## Testing Strategy

### Unit Tests (este plan):
- Funciones puras en `src/lib/business/` — sin mocks, datos directos
- Utilidades en `src/lib/utils.ts` — sin mocks, datos directos
- Schemas Zod en `src/lib/validations/` — safeParse con datos válidos e inválidos

### Edge Cases Cubiertos:
- Prisma Decimal simulado con `{ toString: () => "value" }`
- null/undefined en todas las funciones que los aceptan
- Bordes exactos en porcentajes (=30%, =100%)
- Estados terminales (COMPLETED no puede transicionar)
- Refinements cross-field en orderSchema y orderItemSchema

## File Structure (after implementation)

```
src/lib/
├── utils.ts
├── utils.test.ts
├── business/
│   ├── status.ts
│   ├── status.test.ts
│   ├── profit.ts
│   └── profit.test.ts
└── validations/
    ├── client.ts
    ├── client.test.ts
    ├── category.ts
    ├── category.test.ts
    ├── product.ts
    ├── product.test.ts
    ├── payment.ts
    ├── payment.test.ts
    ├── expense.ts
    ├── expense.test.ts
    ├── rental.ts
    ├── rental.test.ts
    ├── order.ts
    └── order.test.ts
```

## References

- Research: `thoughts/shared/research/2026-02-22_15-54-15_[general]_testing-strategy-codebase-analysis.md`
