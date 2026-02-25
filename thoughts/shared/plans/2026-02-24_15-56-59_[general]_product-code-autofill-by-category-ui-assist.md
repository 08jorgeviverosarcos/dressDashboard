# Product Code Autofill by Category (UI Assist) — Plan de Implementación

## Overview

Implementar una ayuda en UI para que, al seleccionar una categoría en el formulario de producto, se sugiera automáticamente un código con formato `PREFIJO-XXX` (ej: `CV-001`, `CV-002`, `VN-001`), manteniendo el campo `code` editable por el usuario en todo momento.

El objetivo es **asistencia de captura**: sugerir un código útil y rápido, sin convertirlo en regla rígida.

## Current State (resumen del research)

- `Product.code` y `Category.code` son manuales, requeridos y únicos.
- El formulario de producto (`src/app/productos/product-form.tsx`) ya tiene selector de categoría, pero no genera código.
- La unicidad se valida en backend (`products.service.ts`) con `findByCode` / `findByCodeExcluding`.
- No existe hoy lógica de consecutivo por categoría.

## Desired End State

En `Nuevo Producto`:
- El usuario selecciona una categoría.
- El sistema sugiere automáticamente `CATEGORY_CODE-001` o el siguiente consecutivo disponible para esa categoría.
- El usuario puede editar el campo `code` antes de guardar.
- Si el usuario ya escribió manualmente un código, la UI no lo pisa automáticamente.

En `Editar Producto`:
- El código existente se mantiene.
- Si el usuario cambia la categoría, se puede sugerir un nuevo código **solo si** no ha modificado manualmente el campo `code` en esa sesión.

Backend:
- Mantener la validación de unicidad actual al guardar (fuente de verdad final).

## Alcance (In Scope)

- Sugerencia de código por categoría para formulario de productos.
- Nuevo endpoint lógico (server action + service + repo) para calcular sugerencia.
- Integración UI en `product-form` con comportamiento “editable + no sobrescribir entrada manual”.

## Fuera de Alcance (Out of Scope)

- Cambios de schema/migraciones de base de datos.
- Bloquear o forzar formato de código en validación.
- Cambios en formularios de categorías.
- Renombrar códigos existentes.

## Decisiones de diseño para esta implementación

- **Prefijo:** usar `Category.code` como prefijo oficial.
- **Formato sugerido:** `PREFIX-NNN` con padding a 3 dígitos (`001`, `002`, ...).
- **Autoridad del valor:** la sugerencia es solo ayuda visual; el usuario puede modificar libremente.
- **Conflictos concurrentes:** se aceptan en sugerencia; la verificación final sigue en `createProduct/updateProduct`.

## Implementation Approach

Cambios por capas, respetando arquitectura actual:

1. **Repository (`products.repo.ts`)**
   - Agregar función para obtener productos de una categoría cuyo `code` coincida con prefijo `CATEGORY_CODE-`.
   - Retornar solo lo necesario para calcular el siguiente consecutivo.

2. **Service (`products.service.ts`)**
   - Agregar `getSuggestedProductCode(categoryId: string)`.
   - Obtener categoría (`category code`) y códigos existentes de productos de esa categoría.
   - Parsear sufijos numéricos válidos (`NNN`) y calcular `max + 1`.
   - Retornar código sugerido.

3. **Server Action (`src/lib/actions/products.ts`)**
   - Agregar acción `getSuggestedProductCode(categoryId: string)`.
   - Manejar validación mínima de input y delegar al service.

4. **UI (`src/app/productos/product-form.tsx`)**
   - Escuchar cambios de `categoryId`.
   - Pedir sugerencia vía server action al seleccionar categoría.
   - Setear `code` automáticamente solo cuando:
     - `code` esté vacío, o
     - `code` no haya sido editado manualmente en la sesión.
   - Mantener `Input` de `code` editable siempre.
   - Marcar flag local `hasManualCodeEdit` al tipear en `code`.

5. **Pruebas / verificación**
   - Smoke tests manuales de creación/edición con y sin edición manual del código.

---

## Phase 1: Backend Suggestion Pipeline

### 1.1 Repository
**Archivo**: `src/features/products/products.repo.ts`

Agregar funciones nuevas:
- Obtener categoría por id (o reutilizar función existente en categories repo si se prefiere desde service).
- Obtener códigos de productos activos de una categoría con patrón de prefijo.

### 1.2 Service
**Archivo**: `src/features/products/products.service.ts`

Agregar función:
- `getSuggestedProductCode(categoryId: string): Promise<ActionResult<{ code: string }>>` (o retorno equivalente usado por actions actuales).

Reglas:
- Si categoría no existe, error controlado.
- Si no hay códigos válidos para ese prefijo: sugerir `PREFIX-001`.
- Si hay códigos válidos: sugerir siguiente consecutivo.

### 1.3 Server Action
**Archivo**: `src/lib/actions/products.ts`

Agregar action:
- `getSuggestedProductCode(categoryId: string)`.

Responsabilidad:
- Validar input.
- Delegar al service.
- Retornar respuesta consumible por UI.

### Criterios de éxito Fase 1

- Existe una acción invocable que devuelve sugerencia por categoría.
- Con categoría sin productos devuelve `PREFIX-001`.
- Con categoría con productos devuelve siguiente consecutivo.

---

## Phase 2: Integración UI en ProductForm

### 2.1 Estado local para control de sobrescritura
**Archivo**: `src/app/productos/product-form.tsx`

Agregar estado:
- `hasManualCodeEdit` (boolean) para saber si el usuario escribió en `code`.

### 2.2 Flujo al cambiar categoría
- Al cambiar `categoryId`, solicitar sugerencia.
- Aplicar sugerencia si no hay edición manual previa del código.

### 2.3 Edición manual
- En `Input` de `code`, detectar cambio manual y activar `hasManualCodeEdit=true`.
- No bloquear edición ni aplicar readonly.

### Criterios de éxito Fase 2

- Seleccionar categoría autocompleta código sugerido en alta.
- Si usuario modifica el código, nuevas selecciones de categoría no pisan ese valor.
- Guardado sigue funcionando sin cambios en UX de submit.

---

## Phase 3: Verificación funcional

### Manual Smoke Tests

1. **Alta / categoría con historial**
   - Seleccionar categoría con códigos existentes.
   - Ver sugerencia `PREFIX-(último+1)`.
   - Guardar producto; éxito esperado.

2. **Alta / categoría sin historial**
   - Seleccionar categoría nueva.
   - Ver `PREFIX-001`.
   - Guardar; éxito esperado.

3. **Sobrescritura manual**
   - Seleccionar categoría (se autollena).
   - Editar `code` manualmente.
   - Cambiar categoría otra vez.
   - Verificar que no pisa el código manual.

4. **Colisión por concurrencia**
   - Simular dos creaciones paralelas con mismo sugerido.
   - Verificar que backend mantiene error de unicidad existente.

5. **Edición de producto**
   - Abrir producto existente.
   - Confirmar que código inicial se mantiene y es editable.
   - Cambiar categoría y validar comportamiento definido para sesión.

---

## Riesgos y notas operativas

- La sugerencia no evita colisiones concurrentes; la garantía sigue en validación de backend al guardar.
- Se deben ignorar códigos legacy que no cumplan patrón `PREFIX-NNN` al calcular consecutivo.
- Mantener mensajes de error existentes para no romper UX actual.

## Archivos previstos a tocar

- `src/features/products/products.repo.ts`
- `src/features/products/products.service.ts`
- `src/lib/actions/products.ts`
- `src/app/productos/product-form.tsx`

## Referencias

- `thoughts/shared/research/2026-02-24_15-47-32_[general]_product-code-autofill-by-category-current-state.md`

## Execution Progress

- [x] Phase 1.1 Repository implementado
- [x] Phase 1.2 Service implementado
- [x] Phase 1.3 Server Action implementado
- [x] Verificación automática en archivos modificados (`ReadLints` + `eslint`)
- [x] Verificación manual de Fase 1 completada
- [x] Phase 2.1 Estado local en `ProductForm` implementado
- [x] Phase 2.2 Solicitud de sugerencia al cambiar `categoryId` implementada
- [x] Phase 2.3 Protección de edición manual de `code` implementada
- [x] Verificación automática de Fase 2 (`ReadLints` + `eslint` en `product-form`)
- [x] Verificación manual de Fase 2 completada
- [x] Phase 3 Smoke tests funcionales completados (confirmación de usuario)
