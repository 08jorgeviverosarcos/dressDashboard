# Modal Crear Producto (Campos Completos) Implementation Plan

## Overview

Implementar una ampliación de `ProductQuickForm` para que el modal de creación de producto en inventario muestre los mismos campos funcionales del formulario completo de producto, sin cambiar el patrón `EntitySelectorModal` ni refactorizar la arquitectura actual.

## Current State Analysis

Hoy existen dos formularios de creación de producto:

- `src/features/products/components/ProductQuickForm.tsx` (modal): renderiza 5 campos (`code`, `name`, `type`, `inventoryTracking`, `categoryId`) y envía `salePrice`, `rentalPrice`, `cost` como `null` y `description` como `""`.
- `src/app/productos/product-form.tsx` (página): renderiza 9 campos, incluyendo `salePrice`, `rentalPrice`, `cost`, `description`.

El flujo modal vive en `src/app/inventario/nuevo/inventory-item-form.tsx` usando `EntitySelectorModal` con `allowCreate` y `renderCreateForm`.

`createProduct` valida en servidor con `productSchema` (`src/lib/validations/product.ts`), por lo que ya soporta los 4 campos faltantes en el modal.

## Desired End State

El modal "Crear producto" dentro de inventario debe permitir capturar y enviar:

- `code`
- `name`
- `type`
- `inventoryTracking`
- `categoryId`
- `salePrice`
- `rentalPrice`
- `cost`
- `description`

manteniendo el comportamiento actual de:

- selección automática del producto recién creado,
- creación inline de categoría desde el mismo modal,
- autosugerencia de código por categoría,
- estructura responsive del diálogo.

### Key Discoveries:
- `ProductQuickForm` hoy omite 4 campos que sí existen en `ProductForm`: `src/features/products/components/ProductQuickForm.tsx`, `src/app/productos/product-form.tsx`.
- `productSchema` ya contempla todos los campos necesarios: `src/lib/validations/product.ts`.
- El flujo de selección/cierre del modal depende de `EntitySelectorModal` + callback `onCreated`: `src/components/shared/EntitySelectorModal.tsx`, `src/app/inventario/nuevo/inventory-item-form.tsx`.

## What We're NOT Doing

- No unificación/refactor entre `ProductQuickForm` y `ProductForm`.
- No cambios de arquitectura (actions/services/repos).
- No cambios de rutas, navegación ni layout general de inventario.
- No cambios en `productSchema` ni en la capa de persistencia.
- No modificaciones de comportamiento en edición de producto (`/productos/[id]/editar`).

## Implementation Approach

Aplicar un cambio incremental y acotado en `ProductQuickForm`:

1. Añadir estado local para `salePrice`, `rentalPrice`, `cost`, `description`.
2. Renderizar inputs equivalentes a los del formulario completo (reutilizando `MoneyInput` y `Textarea`).
3. Enviar esos valores reales en `createProduct`.
4. Mantener el resto del contrato igual (`onCreated` con `{ id, code, name, inventoryTracking }`).
5. Ajustar solo lo mínimo en layout del modal para conservar responsividad.

## Phase 1: Extender ProductQuickForm con Campos Faltantes

### Overview

Agregar al formulario modal los 4 campos faltantes y conectar esos datos al payload actual de creación.

### Changes Required:

#### 1. ProductQuickForm (estado y UI)
**File**: `src/features/products/components/ProductQuickForm.tsx`  
**Changes**:
- Importar `MoneyInput` y `Textarea`.
- Agregar estado local:
  - `salePrice: number | null`
  - `rentalPrice: number | null`
  - `cost: number | null`
  - `description: string`
- Renderizar sección de precios en grid responsive (`grid-cols-1 sm:grid-cols-3`).
- Renderizar `Textarea` para descripción.
- Preservar `text-base md:text-sm` en inputs/textarea para mobile/iOS.

```tsx
// Dentro de ProductQuickForm (ejemplo de shape objetivo)
const [salePrice, setSalePrice] = useState<number | null>(null);
const [rentalPrice, setRentalPrice] = useState<number | null>(null);
const [cost, setCost] = useState<number | null>(null);
const [description, setDescription] = useState("");

// En el submit:
const result = await createProduct({
  code: code.trim(),
  name: name.trim(),
  type: type as "RENTAL" | "SALE" | "BOTH",
  inventoryTracking,
  categoryId: categoryId || null,
  salePrice,
  rentalPrice,
  cost,
  description: description.trim(),
});
```

#### 2. ProductQuickForm (payload)
**File**: `src/features/products/components/ProductQuickForm.tsx`  
**Changes**:
- Reemplazar valores fijos (`null`/`""`) por los valores capturados del formulario.
- Mantener `onCreated` sin cambios de shape para no romper `InventoryItemForm`.

### Success Criteria:

#### Automated Verification:
- [ ] Typecheck pasa sin errores: `npm run typecheck` (script no disponible actualmente en este repositorio)
- [x] Lint pasa sin errores en archivos tocados: `npm run lint -- src/features/products/components/ProductQuickForm.tsx`
- [ ] Tests de validación de producto pasan: `npm run test -- src/lib/validations/product.test.ts` (fallan actualmente por estado base del repositorio)

#### Manual Verification:
- [ ] En `/inventario/nuevo`, abrir selector de producto y entrar a "Crear producto".
- [ ] El modal muestra los campos: código, nombre, tipo, seguimiento, categoría, precio venta, precio alquiler, costo, descripción.
- [ ] Crear producto con precios/descripcion y confirmar que queda seleccionado automáticamente al cerrar modal.
- [ ] Crear producto sin precios (null) sigue funcionando.
- [ ] Responsive en móvil: grids apilan correctamente y botones permanecen en `DialogFooter`.

**Implementation Note**: Tras completar esta fase y validar checks automáticos, pausar para confirmación manual antes de continuar.

---

## Phase 2: Verificación de Integración Inventario + Modal

### Overview

Confirmar que el flujo completo de crear producto desde modal y luego crear item de inventario no regresa comportamientos.

### Changes Required:

#### 1. Integración del selector de producto
**File**: `src/app/inventario/nuevo/inventory-item-form.tsx`  
**Changes**:
- No cambios funcionales esperados.
- Validar que el contrato de `onCreated` sigue compatible y que `localProducts` se actualiza igual.

#### 2. Comportamiento de modal y creación inline
**File**: `src/components/shared/EntitySelectorModal.tsx`  
**Changes**:
- Sin cambios de código esperados.
- Verificar visualmente que la vista `create` soporta el formulario más largo (scroll y layout).

### Success Criteria:

#### Automated Verification:
- [ ] Build/typecheck sin nuevos errores: `npm run typecheck` (script no disponible; verificación alternativa `npx tsc --noEmit` falla por issues preexistentes del repo)
- [ ] Lint global sin nuevos errores relevantes: `npm run lint` (falla por issues preexistentes en `EntitySelectorModal.tsx` y warnings en otros módulos)

#### Manual Verification:
- [ ] Flujo completo: crear producto en modal → seleccionar producto → agregar item de inventario exitosamente.
- [ ] Crear categoría desde el modal anidado dentro de ProductQuickForm sigue funcionando.
- [ ] Mensajes de éxito/error (toast) se mantienen en el mismo comportamiento esperado.

**Implementation Note**: Tras completar esta fase y validar checks automáticos, pausar para confirmación manual final.

---

## Testing Strategy

### Unit Tests:
- Mantener cobertura de `productSchema` existente.
- Verificar que no se rompe parseo de valores nulos/numéricos en payload desde modal.

### Integration Tests:
- Flujo UI de inventario con creación inline de producto y selección automática posterior.
- Flujo de creación de categoría dentro de ProductQuickForm (modal anidado).

### Manual Testing Steps:
1. Ir a `/inventario/nuevo` y abrir selector de producto.
2. Click en "Crear producto".
3. Completar todos los campos (incluyendo precios y descripción) y guardar.
4. Confirmar selección automática del producto recién creado.
5. Completar datos de inventario y guardar item.
6. Repetir con precios vacíos para verificar compatibilidad.
7. Repetir en viewport móvil para verificar responsividad.

## Performance Considerations

- El cambio no añade nuevas consultas ni nuevos endpoints.
- Impacto principal es de render UI en modal; el costo es bajo.
- Mantener componentes controlados simples (`useState`) evita complejidad adicional.

## Migration Notes

- No hay migraciones de base de datos.
- No hay cambios de contrato en services/repos/actions.
- Cambio backward compatible para flujos existentes.

## References

- Research base: `thoughts/shared/research/2026-02-27_14-48-46_[general]_modales-creacion-producto-campos.md`
- Modal selector pattern: `src/components/shared/EntitySelectorModal.tsx`
- Quick form actual: `src/features/products/components/ProductQuickForm.tsx`
- Full form referencia: `src/app/productos/product-form.tsx`
- Action create product: `src/lib/actions/products.ts`
- Product schema: `src/lib/validations/product.ts`
