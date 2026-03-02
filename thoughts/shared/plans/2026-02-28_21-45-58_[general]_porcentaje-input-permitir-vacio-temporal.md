# Porcentaje Inputs Vacío Temporal Implementation Plan

## Overview

Corregir la experiencia de edición en tres campos de porcentaje para permitir estado temporal vacío mientras el usuario escribe, evitando el comportamiento actual donde reaparece `0` y obliga secuencias como `030` para llegar a `30`.

El alcance es estrictamente de UI en pedidos y no modifica contratos de validación, reglas financieras, ni persistencia.

## Current State Analysis

Hoy los tres campos de porcentaje usan input numérico controlado con conversión inmediata a `number` y/o fallback visual a `0`:

- `src/components/orders/OrderForm.tsx` (`% Abono Mínimo`) usa `value={minPct}` con `setMinPct(Number(e.target.value))`.
- `src/components/orders/OrderItemRow.tsx` (`Descuento (%)`) usa `value={item.discountValue ?? 0}` con `onChange(... Number(e.target.value))`.
- `src/app/(dashboard)/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx` (`Descuento (%)`) usa `value={discountValue ?? 0}` con `setDiscountValue(Number(e.target.value))`.

Esto provoca que cuando el usuario borra el contenido (`''`), se convierta inmediatamente a `0` y vuelva a mostrarse.

### Key Discoveries:
- `OrderForm` ya tiene patrón válido `number | ""` para `orderNumber`, con `e.target.value ? Number(...) : ""` (`src/components/orders/OrderForm.tsx`).
- `orderSchema` ya admite `minDownpaymentPct` en rango `0..100` y `discountValue` como número nullable; no requiere cambios (`src/lib/validations/order.ts`).
- Cálculos y persistencia en services/repos funcionan con número final o `null`; el ajuste es de captura/edición UI (`src/features/orders/orders.service.ts`, `src/features/orders/orders.repo.ts`).

## Desired End State

En los tres campos de porcentaje, el usuario puede borrar el contenido y reescribir sin que el input fuerce `0` durante la edición.  
Al guardar, el valor enviado mantiene el contrato actual (`number` o `null` según aplique), sin cambios en reglas de negocio ni persistencia.

### Verificación del estado deseado
- En `% Abono Mínimo`, borrar y escribir `30` no requiere pasar por `030`.
- En `Descuento (%)` inline y en edición de item, borrar y escribir `30` funciona sin prefijo forzado.
- Guardar pedido/ítem mantiene validaciones actuales y cálculos de subtotal/totales sin regresión.

## What We're NOT Doing

- No se tocan inputs de dinero/no-porcentaje (`adjustmentAmount`, pagos, gastos, etc.).
- No se modifica `MoneyInput`.
- No se cambian `orderSchema`, `orderItemSchema`, server actions, services o repos.
- No se introduce nueva librería ni state manager.
- No se alteran reglas financieras (`deriveStatusAfterPayment`, cálculo de subtotales, etc.).

## Implementation Approach

Aplicar en los tres campos de porcentaje el patrón de edición con estado temporal vacío ya usado en `orderNumber`:

1. Mantener estado de edición como `number | ""` (o `number | null | ""` donde aplique).
2. En `onChange`, mapear `""` a estado vacío temporal, no a `0`.
3. Convertir/normalizar al contrato esperado únicamente al construir payload o al propagar a estado padre de items.
4. Preservar límites actuales (`min`, `max`) y comportamiento existente de submit/errores.

---

## Phase 1: Ajuste de Captura en UI de Porcentaje

### Overview
Actualizar los tres puntos de captura para que soporten vacío temporal durante edición.

### Changes Required:

#### 1. `% Abono Mínimo` en formulario de pedido
**File**: `src/components/orders/OrderForm.tsx`  
**Changes**:
- Cambiar estado de `minPct` a `number | ""` en UI.
- Ajustar `onChange` del input a patrón condicional (`""` vs número).
- Al crear `data: OrderFormData`, normalizar `minDownpaymentPct` a número manteniendo contrato actual.

```tsx
const [minPct, setMinPct] = useState<number | "">(initialData?.minDownpaymentPct ?? 30);

<Input
  type="number"
  min={0}
  max={100}
  value={minPct}
  onChange={(e) => setMinPct(e.target.value ? Number(e.target.value) : "")}
/>

// En submit: minDownpaymentPct: minPct === "" ? 0 : minPct
```

#### 2. `Descuento (%)` inline en rows de items
**File**: `src/components/orders/OrderItemRow.tsx`  
**Changes**:
- Reemplazar `value={item.discountValue ?? 0}` del input de porcentaje por representación que permita vacío temporal.
- En `onChange`, propagar `null`/`""` temporalmente durante edición y número cuando exista valor.
- Mantener rama de monto fijo sin cambios funcionales.

```tsx
<Input
  type="number"
  min={0}
  value={item.discountValue ?? ""}
  onChange={(e) => onChange(index, "discountValue", e.target.value ? Number(e.target.value) : null)}
/>
```

#### 3. `Descuento (%)` en edición de item
**File**: `src/app/(dashboard)/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx`  
**Changes**:
- Ajustar estado local de `discountValue` para soportar vacío temporal.
- Actualizar `onChange` del input de porcentaje para no convertir `""` a `0` al teclear.
- Normalizar en submit al contrato ya existente (`discountValue ?? null`).

```tsx
const [discountValue, setDiscountValue] = useState<number | null | "">(initialValues.discountValue);

<Input
  type="number"
  min={0}
  value={discountValue ?? ""}
  onChange={(e) => setDiscountValue(e.target.value ? Number(e.target.value) : "")}
/>
```

### Success Criteria:

#### Automated Verification:
- [ ] Type check sin errores nuevos: `npm run typecheck`
- [ ] Lint sin errores nuevos: `npm run lint`
- [ ] Tests de validación/reglas financieras siguen pasando: `npm run test -- src/lib/validations/order.test.ts src/lib/business/status.test.ts src/lib/business/profit.test.ts`

#### Manual Verification:
- [ ] En crear/editar pedido, `% Abono Mínimo` permite borrar y escribir sin prefijo `0` forzado.
- [ ] En `OrderItemRow`, `Descuento (%)` permite borrar y escribir sin comportamiento `030`.
- [ ] En edición de item (`order-item-edit-form`), `Descuento (%)` permite borrar y escribir sin `0` forzado.
- [ ] Guardar pedido e item funciona con mensajes y navegación actuales.
- [ ] En mobile y desktop, la UI de formularios mantiene layout responsive actual.

**Implementation Note**: Después de completar esta fase y pasar verificación automatizada, pausar para confirmación manual humana antes de continuar.

---

## Phase 2: Cobertura de Pruebas de Interacción UI (Opcional Recomendado en la misma tarea)

### Overview
Agregar cobertura específica de interacción para evitar regresión del comportamiento de edición de porcentajes.

### Changes Required:

#### 1. Tests de interacción de inputs de porcentaje
**File**: `src/components/orders/OrderForm.test.tsx` (nuevo)  
**File**: `src/components/orders/OrderItemRow.test.tsx` (nuevo)  
**File**: `src/app/(dashboard)/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.test.tsx` (nuevo o equivalente según setup)  
**Changes**:
- Verificar que `clear` + escritura en porcentaje no reinyecta `0` automáticamente.
- Verificar que el valor final enviado/propagado mantiene contrato (`number`/`null`).

```tsx
// ejemplo de intención
await user.clear(inputPct);
await user.type(inputPct, "30");
expect(inputPct).toHaveValue(30);
```

#### 2. Mantener y revalidar pruebas de dominio existentes
**File**: `src/lib/validations/order.test.ts`  
**File**: `src/lib/business/status.test.ts`  
**File**: `src/lib/business/profit.test.ts`  
**Changes**:
- Sin cambios funcionales requeridos; se reejecutan para validar no regresión del dominio.

### Success Criteria:

#### Automated Verification:
- [ ] Nuevas pruebas UI pasan: `npm run test -- src/components/orders/OrderForm.test.tsx src/components/orders/OrderItemRow.test.tsx`
- [ ] Si aplica setup para ruta app, prueba de edición de item pasa.
- [ ] Tests de dominio siguen verdes: `npm run test -- src/lib/validations/order.test.ts src/lib/business/status.test.ts src/lib/business/profit.test.ts`
- [ ] Type check y lint sin errores nuevos.

#### Manual Verification:
- [ ] Se valida en navegador que el bug original no reaparece tras recarga.
- [ ] Se valida flujo completo: crear pedido con descuento %, editar item con descuento %, guardar y revisar detalle.

**Implementation Note**: Después de completar esta fase y pasar verificación automatizada, pausar para confirmación manual humana antes de cerrar la tarea.

---

## Testing Strategy

### Unit Tests:
- Interacción de inputs de porcentaje con estado vacío temporal.
- Conversión final en submit para mantener shape de datos esperado.

### Integration Tests:
- Flujo crear pedido con item descuento `%`.
- Flujo editar item de pedido y persistir descuento `%`.

### Manual Testing Steps:
1. Crear pedido nuevo y en `% Abono Mínimo` borrar `30` y escribir `45`.
2. En un item inline, seleccionar descuento `%`, borrar valor y escribir `30`.
3. Guardar pedido y verificar subtotal/totales.
4. Abrir edición de item, repetir borrado/escritura en `%`, guardar y validar detalle.
5. Confirmar que no cambian estados de pedido por pagos fuera de lo esperado.

## Performance Considerations

No se esperan impactos de rendimiento; los cambios son de estado local y handlers de `onChange` en inputs existentes.

## Migration Notes

No hay migraciones de base de datos ni cambios de esquema.  
No hay cambios en contratos de server actions ni en payload persistido más allá de normalización UI al enviar.

## References

- Research base: `thoughts/shared/research/2026-02-28_21-36-11_[general]_porcentaje-input-0-no-deja-borrar-current-state.md`
- Contexto de inputs numéricos: `thoughts/shared/research/2026-02-22_21-27-06_[general]_money-input-mask-current-state.md`
- Contexto de `minDownpaymentPct`: `thoughts/shared/research/2026-02-25_13-17-31_[general]_eliminar-abono-minimo-pedidos-current-state.md`
- Patrón existente de vacío temporal: `src/components/orders/OrderForm.tsx`
- Puntos a corregir:
  - `src/components/orders/OrderForm.tsx`
  - `src/components/orders/OrderItemRow.tsx`
  - `src/app/(dashboard)/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx`
- Contratos que se preservan:
  - `src/lib/validations/order.ts`
  - `src/lib/actions/orders.ts`
  - `src/features/orders/orders.service.ts`
  - `src/features/orders/orders.repo.ts`
