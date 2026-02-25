---
date: 2026-02-24T15:47:32-0500
researcher: Cursor AI
git_commit: 4bad6157d9239f875d3fe1ad201bc78bbc2e0bb3
branch: main
repository: dressDashboard
topic: "Autollenado de código de producto por categoría (prefijo + consecutivo) — estado actual"
tags: [research, codebase, products, categories, product-code, ui-forms]
status: complete
last_updated: 2026-02-24
last_updated_by: Cursor AI
---

# Research: Autollenado de código de producto por categoría (prefijo + consecutivo) — estado actual

**Date**: 2026-02-24T15:47:32-0500  
**Researcher**: Cursor AI  
**Git Commit**: `4bad6157d9239f875d3fe1ad201bc78bbc2e0bb3`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

Cómo está implementado hoy el alta/edición de productos y categorías para evaluar un flujo donde el código de producto se sugiera automáticamente al seleccionar categoría (ej: `CV-001`, `CV-002`, `VN-001`) pero siga siendo editable por el usuario.

## Summary

Hoy el sistema maneja `code` de `Product` y `Category` como campos manuales, requeridos y únicos.  
El formulario de producto sí permite seleccionar categoría en UI, pero no existe lógica de autollenado del código basada en esa selección.  
No hay implementación actual de consecutivo por categoría (`prefijo + correlativo`) ni en frontend ni en backend para `Product.code`.  
El patrón actual para unicidad es validación previa por búsqueda (`findByCode`) en servicio y persistencia directa del código ingresado por usuario.

## Detailed Findings

### Modelo de datos

- `Category.code` es `String @unique`.
- `Product.code` es `String @unique`; `Product` tiene `categoryId` opcional relacionado a `Category`.
- Referencias:
  - `prisma/schema.prisma` (`Category` y `Product`)
  - https://github.com/08jorgeviverosarcos/dressDashboard/blob/4bad6157d9239f875d3fe1ad201bc78bbc2e0bb3/prisma/schema.prisma#L23-L56

### UI actual de creación/edición de producto

- La página de nuevo producto carga categorías con `getCategories()` y renderiza `ProductForm`.
- La página de edición carga producto + categorías y prellena `code` con el valor guardado.
- `ProductForm` define `defaultValues.code = ""` en creación.
- `code` es un `Input` editable manualmente (`placeholder="VG-001"`).
- `categoryId` se maneja con `Select`, pero no dispara ninguna generación/sugerencia de `code`.
- Referencias:
  - `src/app/productos/nuevo/page.tsx`
  - `src/app/productos/[id]/editar/page.tsx`
  - `src/app/productos/product-form.tsx`

### Validación y envío

- En cliente: `react-hook-form` + `zodResolver(productSchema)`.
- `productSchema` exige `code` no vacío.
- En submit: se llama `createProduct` o `updateProduct`.
- En server action: se vuelve a validar con Zod (`safeParse`), y luego se delega al servicio.
- Referencias:
  - `src/lib/validations/product.ts`
  - `src/app/productos/product-form.tsx`
  - `src/lib/actions/products.ts`

### Servicio y repositorio (producto)

- En create/update, el servicio verifica unicidad de código:
  - `findByCode(parsed.code)` en create.
  - `findByCodeExcluding(parsed.code, id)` en update.
- Si no hay conflicto, persiste exactamente el `code` recibido desde UI.
- No existe función actual para:
  - calcular iniciales desde categoría,
  - buscar último correlativo por categoría,
  - construir formato tipo `XX-001`.
- Referencias:
  - `src/features/products/products.service.ts`
  - `src/features/products/products.repo.ts`

### Categorías (origen del posible prefijo)

- La categoría también tiene `code` manual:
  - alta y edición usan `Input` editable.
  - validación exige `code` no vacío.
  - servicio valida unicidad por `findByCode`.
- Referencias:
  - `src/app/categorias/nuevo/page.tsx`
  - `src/app/categorias/[id]/editar/page.tsx`
  - `src/lib/validations/category.ts`
  - `src/features/categories/categories.service.ts`
  - `src/features/categories/categories.repo.ts`

### Patrones relacionados de consecutivos

- Existe antecedente de consecutivo en `Order.orderNumber`, pero hoy es manual (sin default autoincrement en esquema actual).
- Ese patrón no está conectado al código de producto/categoría; solo muestra que sí hubo trabajo de numeración consecutiva en otro dominio.
- Referencias:
  - `prisma/schema.prisma` (`Order.orderNumber`)
  - `thoughts/shared/research/2026-02-21_10-30-00_[general]_ordernumber-migration-strategy.md`

## Code References

- `prisma/schema.prisma` — definición de `Category.code`, `Product.code`, `Product.categoryId`, `Order.orderNumber`.
- `src/app/productos/product-form.tsx` — campos `code` y `categoryId`, submit create/update.
- `src/app/productos/nuevo/page.tsx` — carga de categorías para create.
- `src/app/productos/[id]/editar/page.tsx` — carga de producto + categorías y prefill.
- `src/lib/validations/product.ts` — `code` requerido.
- `src/lib/actions/products.ts` — validación server y delegación a servicio.
- `src/features/products/products.service.ts` — validación de unicidad de código.
- `src/features/products/products.repo.ts` — búsquedas por código y persistencia.
- `src/lib/validations/category.ts` — `code` de categoría requerido.
- `src/features/categories/categories.service.ts` / `src/features/categories/categories.repo.ts` — unicidad y CRUD de categoría.

## Architecture Insights

- El sistema actual trata el código de producto como dato manual del usuario, con control de unicidad en backend.
- La selección de categoría en UI ya existe en el formulario, pero opera de manera independiente al campo `code`.
- La capa actual (UI + action + service + repo) no contiene una pieza dedicada a “sugerencia de código” o “secuencia por categoría”.
- La forma de consumo en UI permite conceptualmente un autollenado opcional porque `code` ya es un input editable (no readonly).

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-24_22-00-00_general_entity-selector-modal-pattern-spec.md`
  - Documenta que `ProductForm` actualmente usa `Select` para categoría y no hay patrón actual de selector con lógica adicional de generación de código.
- `thoughts/shared/research/2026-02-21_10-30-00_[general]_ordernumber-migration-strategy.md`
  - Contexto histórico de consecutivos en otro módulo (`orderNumber`) y su operación actual manual.
- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
  - Ejemplo de documentación de flujos actuales y contratos de datos, útil como contexto metodológico.

## Related Research

- `thoughts/shared/research/2026-02-24_22-00-00_general_entity-selector-modal-pattern-spec.md`
- `thoughts/shared/research/2026-02-21_10-30-00_[general]_ordernumber-migration-strategy.md`
- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`

## Open Questions

- Qué valor debe usarse como prefijo oficial del código sugerido: ¿`Category.code`, iniciales derivadas de `Category.name`, o ambos con fallback?
- En edición de producto, si cambia categoría, ¿se sugiere un nuevo código solo si el usuario no lo modificó manualmente en esa sesión?
- Para el correlativo por categoría, el estado actual no define estrategia de cómputo (por conteo, por máximo existente parseado, etc.); solo existe validación de unicidad final.
