# orderNumber Manual Input — Implementation Plan

## Overview

Hacer que `orderNumber` sea un campo manual ingresado por el usuario al crear un pedido, en vez de auto-generado por PostgreSQL. Esto permite la migración suave desde facturas físicas (~470 actualmente) al sistema digital durante ~2 meses. Después de ese periodo, se restaurará el autoincrement (Fase 2, fuera de alcance de este plan).

## Current State Analysis

- `orderNumber` es `Int @unique @default(autoincrement())` — `SERIAL` en PostgreSQL (`prisma/schema.prisma:69`)
- No aparece en ningún formulario, Zod schema, action, ni service
- Se muestra en 16+ ubicaciones de UI como `#N` y se usa en 2 filtros de búsqueda
- El `OrderData` type en `orders.repo.ts:5-16` no incluye `orderNumber`
- `repo.create()` (`orders.repo.ts:63-98`) no pasa `orderNumber` a `prisma.order.create()`
- `repo.updateInTransaction()` (`orders.repo.ts:110-194`) lista campos explícitamente (no spread) — no incluye `orderNumber`

### Key Discoveries:
- `updateInTransaction` no hace spread de `orderData`, lista cada campo individualmente → `orderNumber` en `OrderData` no afecta updates
- El formulario `OrderForm` ya distingue create vs edit con `initialData` — podemos mostrar `orderNumber` disabled en edit
- La edit page (`pedidos/[id]/editar/page.tsx:38-62`) construye `initialData` manualmente → necesita incluir `orderNumber`

## Desired End State

Al crear un pedido, el usuario ingresa manualmente el número de factura. Al editar, el número se muestra pero no es editable. Todas las demás funcionalidades (display, búsqueda, etc.) siguen funcionando sin cambios.

### Verificación:
- Crear pedido requiere ingresar `orderNumber` manualmente
- No se puede crear dos pedidos con el mismo número (unique constraint)
- Editar pedido muestra el número pero no permite cambiarlo
- Todas las vistas existentes siguen mostrando `#N` correctamente

## What We're NOT Doing

- Fase 2 (restaurar autoincrement) — se hará en ~2 meses
- Seed de datos existentes de facturas físicas
- Cambios en display (16+ ubicaciones ya leen `orderNumber`)
- Cambios en filtros de búsqueda (ya buscan por `orderNumber`)
- Cambios en repos de lectura (expenses, payments, dashboard)

## Implementation Approach

Cambio bottom-up: schema → validación → repo → form → pages. Solo se tocan 5 archivos.

---

## Phase 1: Schema + Migration

### Overview
Quitar el autoincrement de `orderNumber` en Prisma y generar la migración.

### Changes Required:

#### 1. Prisma Schema
**File**: `prisma/schema.prisma`
**Changes**: Quitar `@default(autoincrement())` de `orderNumber`

```prisma
# Antes:
orderNumber       Int         @unique @default(autoincrement())

# Después:
orderNumber       Int         @unique
```

#### 2. Migration
Generar con `npx prisma migrate dev --name make_ordernumber_manual`. Prisma generará:

```sql
ALTER TABLE "Order" ALTER COLUMN "orderNumber" DROP DEFAULT;
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration se genera: `npx prisma migrate dev --name make_ordernumber_manual`
- [ ] `npx prisma generate` sin errores
- [ ] TypeScript compila: `npx tsc --noEmit` (puede haber errores preexistentes en product-form.tsx, ignorar)

#### Manual Verification:
- [ ] La migración se aplicó a la base de datos
- [ ] Los pedidos existentes conservan su `orderNumber`

---

## Phase 2: Validación Zod + Repo

### Overview
Agregar `orderNumber` al flujo de datos: Zod schema → OrderData type → repo.create().

### Changes Required:

#### 1. Zod Schema
**File**: `src/lib/validations/order.ts`
**Changes**: Agregar `orderNumber` a `orderSchema`

```typescript
export const orderSchema = z.object({
  orderNumber: z.number().int().min(1, "El número de pedido es requerido"),
  clientId: z.string().min(1, "Seleccione un cliente"),
  // ... resto igual
```

#### 2. OrderData Type
**File**: `src/features/orders/orders.repo.ts`
**Changes**: Agregar `orderNumber` al type `OrderData` (líneas 5-16)

```typescript
type OrderData = {
  orderNumber: number;
  clientId: string;
  // ... resto igual
};
```

#### 3. repo.create()
**File**: `src/features/orders/orders.repo.ts`
**Changes**: Agregar `orderNumber` al `data` de `prisma.order.create()` (después de línea 65)

```typescript
data: {
  orderNumber: orderData.orderNumber,
  clientId: orderData.clientId,
  // ... resto igual
```

**NOTA**: `updateInTransaction()` NO se modifica — lista campos explícitamente y no incluirá `orderNumber`. El valor fluye por el pipeline pero no se persiste en updates.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila: `npx tsc --noEmit`

#### Manual Verification:
- [ ] N/A (sin UI aún)

---

## Phase 3: Formulario + Pages

### Overview
Agregar el campo `orderNumber` al formulario de pedidos y a las páginas que pasan datos al formulario.

### Changes Required:

#### 1. OrderForm — interface + state + UI
**File**: `src/components/orders/OrderForm.tsx`

**A) Agregar `orderNumber` a `initialData` interface** (línea 40-62):
```typescript
initialData?: {
  id: string;
  orderNumber: number;  // NUEVO
  clientId: string;
  // ... resto igual
```

**B) Agregar state** (después de línea 82):
```typescript
const [orderNumber, setOrderNumber] = useState<number | "">(initialData?.orderNumber ?? "");
```

**C) Agregar validación client-side** en `handleSubmit` (después de check de `clientId`, ~línea 128):
```typescript
if (!orderNumber) {
  toast.error("Ingrese el número de pedido");
  return;
}
```

**D) Agregar `orderNumber` al objeto `data`** (línea 140-164):
```typescript
const data: OrderFormData = {
  orderNumber: Number(orderNumber),
  clientId,
  // ... resto igual
```

**E) Agregar campo UI** en el primer grid (línea 191). Cambiar el grid de 2 columnas a 3 columnas y agregar el campo antes de Cliente:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
  <div className="space-y-2">
    <Label># Pedido *</Label>
    <Input
      type="number"
      min={1}
      value={orderNumber}
      onChange={(e) => setOrderNumber(e.target.value ? Number(e.target.value) : "")}
      placeholder="Ej: 471"
      disabled={!!initialData}
      required
    />
  </div>
  <div className="space-y-2">
    <Label>Cliente *</Label>
    {/* ... select existente sin cambios */}
  </div>
  <div className="space-y-2">
    <Label>Fecha del Pedido</Label>
    {/* ... input existente sin cambios */}
  </div>
</div>
```

#### 2. Edit Page — pasar orderNumber
**File**: `src/app/pedidos/[id]/editar/page.tsx`
**Changes**: Agregar `orderNumber` a `initialData` (línea 38-62)

```typescript
initialData={{
  id: order.id,
  orderNumber: order.orderNumber,  // NUEVO
  clientId: order.clientId,
  // ... resto igual
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila: `npx tsc --noEmit`
- [ ] Build completo: `npm run build`

#### Manual Verification:
- [ ] Crear pedido nuevo: campo `# Pedido` visible, requerido, acepta número
- [ ] Crear pedido con número duplicado: muestra error de unique constraint
- [ ] Editar pedido existente: campo `# Pedido` visible pero deshabilitado, muestra el número actual
- [ ] Guardar edición: funciona sin cambiar el número
- [ ] Todas las vistas existentes (lista, detalle, pagos, gastos, dashboard) siguen mostrando `#N` correctamente
- [ ] Búsqueda por número sigue funcionando en pedidos y pagos

---

## Migration Notes

- Los pedidos existentes en la base de datos conservan su `orderNumber` — la migración solo quita el DEFAULT
- La secuencia SERIAL de PostgreSQL queda huérfana pero no causa problemas
- En Fase 2 (~2 meses): se creará una nueva secuencia con `START WITH max(orderNumber)+1` y se restaurará `@default(autoincrement())`

## References

- Research document: `thoughts/shared/research/2026-02-21_10-30-00_[general]_ordernumber-migration-strategy.md`
