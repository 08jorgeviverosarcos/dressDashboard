# Order Adjustment + Rental Deposit Implementation Plan

## Overview

Implementar los cambios funcionales aprobados:
- Eliminar `chargedIncome` y `pickupDate` de `Rental`.
- Agregar `deposit` en `Rental` como dato operativo (sin impacto en total/pagos).
- Agregar `adjustmentAmount` y `adjustmentReason` en `Order`.
- Hacer que `adjustmentAmount` afecte el `totalPrice` de la orden.
- Exigir `adjustmentReason` cuando `adjustmentAmount !== 0`.

## Current State Analysis

- `Order.totalPrice` se calcula en `src/components/orders/OrderForm.tsx` y se persiste sin recálculo en backend.
- `Rental` hoy contiene `pickupDate` y `chargedIncome` (`prisma/schema.prisma`), además de `returnDate` y `actualReturnDate`.
- El flujo de pagos, % pagado, transición de estado y dashboard depende de `order.totalPrice`:
  - `src/features/payments/payments.service.ts`
  - `src/lib/business/status.ts`
  - `src/features/dashboard/dashboard.service.ts`
- `rentalPickupDate` existe en:
  - `src/lib/validations/order.ts`
  - `src/components/orders/OrderForm.tsx`
  - `src/components/orders/OrderItemRow.tsx`
  - `src/features/orders/orders.service.ts`
  - `src/features/orders/orders.repo.ts`

## Desired End State

Al finalizar este plan:
- `Order` tendrá `adjustmentAmount` (positivo o negativo) y `adjustmentReason`.
- `totalPrice` quedará como total final de la orden (items +/- ajuste global).
- `adjustmentReason` será obligatorio cuando `adjustmentAmount` sea distinto de 0.
- `Rental` tendrá `deposit` y ya no tendrá `pickupDate` ni `chargedIncome`.
- `OrderItem`/formulario ya no manejará `rentalPickupDate`.
- `deposit` no impactará pagos, % pagado, estados ni métricas financieras de dashboard.

### Key Discoveries
- El total de orden ya se centraliza en `OrderForm`, lo que permite incluir el ajuste sin rediseñar pagos.
- `payments.service.ts` valida contra `order.totalPrice`; por eso basta con persistir el total ajustado.
- `calculateRentalProfit` depende de `chargedIncome`; al eliminarlo, debe retirarse/adaptarse su uso en UI de alquiler.

## What We're NOT Doing

- No cambiar la arquitectura por capas ni contratos `ActionResult`.
- No introducir nuevos módulos de pagos o contabilidad.
- No hacer que `deposit` afecte el `totalPrice` ni el flujo de abonos.
- No rediseñar el módulo de costos de alquiler (`RentalCost`) más allá de lo necesario por el cambio de campos.
- No hacer refactors amplios fuera de archivos impactados por estos requisitos.

## Implementation Approach

Estrategia incremental en 6 fases:
1) Base de datos y migración, 2) validación/contratos, 3) cálculo y persistencia de total ajustado, 4) flujo de alquiler con depósito, 5) vistas dependientes, 6) verificación integral.

Se preserva el comportamiento existente de pagos/estados/dashboard usando `order.totalPrice` como fuente única del total exigible.

---

## Phase 1: Schema y Migración

### Overview
Actualizar Prisma para reflejar los nuevos campos y remover los obsoletos.

### Changes Required

#### 1. Prisma models
**File**: `prisma/schema.prisma`
**Changes**:
- En `Order` agregar:
  - `adjustmentAmount Decimal @default(0) @db.Decimal(12, 2)`
  - `adjustmentReason String?`
- En `Rental`:
  - Eliminar `pickupDate`
  - Eliminar `chargedIncome`
  - Agregar `deposit Decimal @default(0) @db.Decimal(12, 2)`

```prisma
model Order {
  // ...
  totalPrice        Decimal     @db.Decimal(12, 2)
  totalCost         Decimal     @default(0) @db.Decimal(12, 2)
  adjustmentAmount  Decimal     @default(0) @db.Decimal(12, 2)
  adjustmentReason  String?
  // ...
}

model Rental {
  id               String       @id @default(cuid())
  orderItemId      String?      @unique
  returnDate       DateTime?
  actualReturnDate DateTime?
  deposit          Decimal      @default(0) @db.Decimal(12, 2)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  // ...
}
```

#### 2. Migration + seed
**Files**:
- `prisma/migrations/<timestamp>_order-adjustment-rental-deposit/migration.sql`
- `prisma/seed.ts`

**Changes**:
- Generar migración para columnas nuevas y removidas.
- Ajustar seed para crear `Rental` con `deposit`, sin `pickupDate` ni `chargedIncome`.

### Success Criteria

#### Automated Verification:
- [x] Migración se genera: `npx prisma migrate dev --name order_adjustment_rental_deposit`
- [x] Prisma client actualizado: `npx prisma generate`
- [x] Seed compila/ejecuta: `npx prisma db seed`

#### Manual Verification:
- [ ] `Order` tiene `adjustmentAmount` y `adjustmentReason` en BD.
- [ ] `Rental` ya no tiene `pickupDate/chargedIncome` y sí tiene `deposit`.

**Implementation Note**: Pausar para validación manual antes de continuar.

---

## Phase 2: Validaciones y contratos de datos

### Overview
Alinear Zod/types/actions con el nuevo contrato funcional.

### Changes Required

#### 1. Order validation
**File**: `src/lib/validations/order.ts`
**Changes**:
- Agregar `adjustmentAmount` (número, puede ser positivo o negativo).
- Agregar `adjustmentReason`.
- Regla condicional: si `adjustmentAmount !== 0`, `adjustmentReason` obligatorio.
- Eliminar `rentalPickupDate` del `orderItemSchema`.

```ts
const orderSchema = z.object({
  // ...
  adjustmentAmount: z.number().default(0),
  adjustmentReason: z.string().optional().or(z.literal("")),
}).refine(
  (data) => data.adjustmentAmount === 0 || !!data.adjustmentReason?.trim(),
  { message: "Ingrese el motivo del ajuste", path: ["adjustmentReason"] }
);
```

#### 2. Rental validation
**File**: `src/lib/validations/rental.ts`
**Changes**:
- Eliminar `pickupDate` y `chargedIncome`.
- Agregar `deposit`.

#### 3. Rental actions payload
**File**: `src/lib/actions/rentals.ts`
**Changes**:
- `createRental` y `updateRental` reciben/envían `deposit`.
- Remover `pickupDate` y `chargedIncome` del payload.

### Success Criteria

#### Automated Verification:
- [x] Typecheck de validaciones/actions: `npm run typecheck`
- [x] Lint de archivos tocados: `npm run lint`

#### Manual Verification:
- [ ] Si ajuste es 0, motivo no obligatorio.
- [ ] Si ajuste es distinto de 0, motivo obligatorio.
- [ ] No hay campo pickup date en payload de order/rental.

**Implementation Note**: Pausar para validación manual antes de continuar.

---

## Phase 3: Cálculo de total ajustado en pedidos

### Overview
Integrar ajuste global de orden en el cálculo y persistencia de `totalPrice`.

### Changes Required

#### 1. Order form state y cálculo
**File**: `src/components/orders/OrderForm.tsx`
**Changes**:
- Añadir estado/UI para `adjustmentAmount` y `adjustmentReason`.
- Calcular subtotal items como hoy.
- Calcular `totalPrice = subtotalItems + adjustmentAmount`.
- En `initialData` incluir ajuste/motivo.
- Remover `rentalPickupDate` de item state/payload.

```ts
const itemsSubtotal = items.reduce(/* lógica actual con descuentos */ , 0);
const totalPrice = itemsSubtotal + adjustmentAmount;
```

#### 2. Order row UI cleanup
**File**: `src/components/orders/OrderItemRow.tsx`
**Changes**:
- Quitar campo `rentalPickupDate`.
- Mantener `rentalReturnDate` para RENTAL.

#### 3. Persistencia de ajuste
**Files**:
- `src/features/orders/orders.repo.ts`
- `src/features/orders/orders.service.ts`
- `src/app/pedidos/[id]/editar/page.tsx`

**Changes**:
- Incluir `adjustmentAmount` y `adjustmentReason` en `OrderData`, create y update.
- Remover escritura de `pickupDate` al crear/actualizar rentals.
- Mantener `totalPrice` persistido como total final ajustado.
- Cargar valores de ajuste en `initialData` para edición.

### Success Criteria

#### Automated Verification:
- [x] Build/typecheck sin errores: `npm run build`
- [x] Lint sin errores en archivos modificados: `npm run lint`

#### Manual Verification:
- [ ] Ajuste positivo incrementa total.
- [ ] Ajuste negativo reduce total.
- [ ] Motivo obligatorio cuando ajuste != 0.
- [ ] Crear/editar pedido conserva ajuste y total recalculado correctamente.

**Implementation Note**: Pausar para validación manual antes de continuar.

---

## Phase 4: Rental con deposit (operativo)

### Overview
Reemplazar el uso de ingreso cobrado/pickup por depósito operativo.

### Changes Required

#### 1. Repo/service de rentals
**Files**:
- `src/features/rentals/rentals.repo.ts`
- `src/features/rentals/rentals.service.ts`

**Changes**:
- En tipos y operaciones create/update usar `deposit`.
- Eliminar referencias a `pickupDate` y `chargedIncome`.

#### 2. Orders create/update rental inline
**Files**:
- `src/features/orders/orders.service.ts`
- `src/features/orders/orders.repo.ts`

**Changes**:
- Al crear rental inline usar `returnDate` y `deposit` (default 0).
- Eliminar cualquier mapping de `pickupDate`.

#### 3. Rental manager UI
**File**: `src/app/pedidos/[id]/alquiler/rental-manager.tsx`
**Changes**:
- Quitar campo/summary de “Ingreso Cobrado”.
- Quitar campo de “Fecha de Recogida”.
- Agregar campo de “Depósito”.
- Ajustar cards/labels para que reflejen dato operativo de depósito.
- Retirar dependencia de `calculateRentalProfit(chargedIncome, ...)` en esta pantalla.

#### 4. Page contract
**File**: `src/app/pedidos/[id]/alquiler/page.tsx`
**Changes**:
- Revisar prop `orderTotal`; mantenerla solo si sigue siendo necesaria para UI.

### Success Criteria

#### Automated Verification:
- [x] Typecheck de rentals/order flows: `npm run typecheck`
- [x] Build de app: `npm run build`

#### Manual Verification:
- [ ] Se puede crear alquiler con `deposit`.
- [ ] Se puede actualizar `returnDate`, `actualReturnDate` y `deposit`.
- [ ] No se muestra ni se edita `pickupDate` ni `chargedIncome`.
- [ ] Costos de alquiler siguen funcionando (agregar/eliminar).

**Implementation Note**: Pausar para validación manual antes de continuar.

---

## Phase 5: Vistas dependientes (pedido/pagos/dashboard)

### Overview
Asegurar consistencia visual y funcional en pantallas y métricas que dependen del total.

### Changes Required

#### 1. Pedido detalle/listado
**Files**:
- `src/app/pedidos/[id]/page.tsx`
- `src/app/pedidos/orders-table.tsx`

**Changes**:
- Mostrar `adjustmentAmount` y `adjustmentReason` en detalle de pedido.
- Confirmar que total mostrado corresponde al total ajustado persistido.

#### 2. Pagos y timeline
**Files**:
- `src/components/orders/PaymentDialog.tsx`
- `src/components/orders/PaymentTimeline.tsx`
- `src/features/payments/payments.service.ts`
- `src/lib/business/status.ts`

**Changes**:
- Sin cambio de fórmula: usar `order.totalPrice` como hoy.
- Validar que al incluir ajuste en total, límites de pago/%/status siguen correctos.

#### 3. Dashboard
**Files**:
- `src/features/dashboard/dashboard.repo.ts`
- `src/features/dashboard/dashboard.service.ts`

**Changes**:
- Mantener lógica actual (usa `totalPrice`).
- Validar que métricas reflejen total ajustado.

### Success Criteria

#### Automated Verification:
- [x] Lint + build completos: `npm run lint && npm run build`

#### Manual Verification:
- [ ] En detalle de pedido se ven ajuste y motivo.
- [ ] Registro de pagos respeta nuevo total ajustado.
- [ ] % pagado y transiciones de estado siguen coherentes.
- [ ] Dashboard refleja órdenes completadas con total ajustado.
- [ ] Depósito no altera pagos, % ni dashboard.

**Implementation Note**: Pausar para validación manual antes de continuar.

---

## Phase 6: Cierre técnico y smoke tests completos

### Overview
Verificación final end-to-end y revisión de regresiones.

### Changes Required

#### 1. Revisiones técnicas finales
**Files**: todos los tocados en fases previas
**Changes**:
- Confirmar que no quedan referencias a:
  - `chargedIncome`
  - `pickupDate`
  - `rentalPickupDate`
- Confirmar coherencia de imports/tipos.

#### 2. Smoke manual integral
1. Crear pedido con ajuste + motivo y validar total.
2. Crear pedido con ajuste 0 sin motivo y validar aceptación.
3. Editar pedido cambiando ajuste positivo/negativo.
4. Registrar pagos parciales y validar límites contra total ajustado.
5. Crear/editar alquiler con `deposit` y fechas de devolución.
6. Registrar costos de alquiler y validar que el flujo permanece estable.

### Success Criteria

#### Automated Verification:
- [x] `npx prisma generate`
- [ ] `npm run typecheck`
- [x] `npm run lint`
- [ ] `npm run build`

#### Manual Verification:
- [ ] Sin regresiones visibles en crear/editar pedido.
- [ ] Sin regresiones visibles en alquiler.
- [ ] Sin regresiones visibles en pagos y dashboard.

**Implementation Note**: Tras completar esta fase, solicitar validación humana final antes de cualquier despliegue.

---

## Testing Strategy

### Unit Tests
- Validación condicional de `adjustmentReason` con `adjustmentAmount`.
- Cálculo de total final con ajuste positivo/negativo.
- Serialización de payloads order/rental sin campos eliminados.

### Integration Tests
- Crear pedido con ajuste y verificar persistencia.
- Editar pedido y verificar recalculo de total.
- Crear pago y validar límite sobre total ajustado.
- Crear/actualizar rental con deposit y costos.

### Manual Testing Steps
1. Crear pedido con dos items y ajuste positivo.
2. Repetir con ajuste negativo.
3. Probar ajuste no cero sin motivo (debe bloquear).
4. Probar alquiler sin pickup/chargedIncome y con deposit.
5. Validar que deposit no cambia total, pagos ni estado.

## Performance Considerations

- No se agregan cálculos complejos nuevos; ajuste es suma/resta O(1) sobre subtotal existente.
- Cambios en dashboard/pagos reutilizan `totalPrice` persistido.
- Impacto mínimo en consultas Prisma (campos extra de lectura/escritura).

## Migration Notes

- Backward-compatible a nivel de pedidos (nuevos campos con defaults/nullables).
- `Rental.chargedIncome`/`Rental.pickupDate` se eliminan; revisar datos históricos según necesidad de negocio.
- En datos existentes, `adjustmentAmount` queda en `0` y `adjustmentReason` en `null` hasta edición.

## References

- Research base: `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
- Related research: `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
- Related plan: `thoughts/shared/plans/2026-02-20_18-09-05_[general]_orderitem-type-discount-rental-inline.md`
- Schema: `prisma/schema.prisma`
- Orders form: `src/components/orders/OrderForm.tsx`
- Rentals manager: `src/app/pedidos/[id]/alquiler/rental-manager.tsx`
