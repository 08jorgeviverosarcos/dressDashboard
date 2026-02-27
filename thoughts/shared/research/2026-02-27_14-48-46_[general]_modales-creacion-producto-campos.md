---
date: 2026-02-27T14:48:46-05:00
researcher: GPT-5.3 Codex
git_commit: 04bfc31
branch: main
repository: dressDashboard
topic: "Modales de creación de producto: campos mostrados vs formulario completo"
tags: [research, codebase, products, modal, inventory, entity-selector]
status: complete
last_updated: 2026-02-27
last_updated_by: GPT-5.3 Codex
---

# Research: Modales de creación de producto y campos visibles

**Date**: 2026-02-27T14:48:46-05:00  
**Researcher**: GPT-5.3 Codex  
**Git Commit**: `04bfc31`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question
`/research_codebase necesito en modales donde se pueda crear producto, que se muestre todos los campos para agregar no solamente unos pocos como esta ahora`

## Summary
Actualmente, la creación de producto en modal usa un formulario rápido (`ProductQuickForm`) que muestra solo 5 campos (`code`, `name`, `type`, `inventoryTracking`, `categoryId`).  
El formulario completo de producto (`product-form.tsx`) muestra 9 campos y agrega `salePrice`, `rentalPrice`, `cost` y `description`.  
El flujo modal de creación encontrado está en el selector de productos de inventario (`/inventario/nuevo`) mediante `EntitySelectorModal` en vista `create`.

## Detailed Findings

### Flujo activo de creación de producto en modal
- El punto de entrada está en `src/app/inventario/nuevo/inventory-item-form.tsx`, donde `EntitySelectorModal` habilita `allowCreate` y usa `ProductQuickForm` como `renderCreateForm`.
- `EntitySelectorModal` maneja dos vistas (`list` y `create`) y, al crear exitosamente, llama `onSelect(item)` y cierra el modal.
- La navegación funcional de usuario es: `/inventario` → botón “Agregar Item” → `/inventario/nuevo` → selector de producto → botón “Crear producto”.

### Campos del modal (`ProductQuickForm`)
- Archivo: `src/features/products/components/ProductQuickForm.tsx`.
- Campos visibles renderizados:
  - `code`
  - `name`
  - `type`
  - `inventoryTracking`
  - `categoryId` (con selector modal de categorías)
- En el submit del quick form, además de esos campos, se envía:
  - `salePrice: null`
  - `rentalPrice: null`
  - `cost: null`
  - `description: ""`

### Campos del formulario completo (`product-form.tsx`)
- Archivo: `src/app/productos/product-form.tsx`.
- Campos visibles renderizados:
  - `code`
  - `name`
  - `type`
  - `inventoryTracking`
  - `categoryId`
  - `salePrice`
  - `rentalPrice`
  - `cost`
  - `description`

### Diferencia exacta de campos
- Campos presentes en formulario completo y ausentes en el modal rápido:
  - `salePrice`
  - `rentalPrice`
  - `cost`
  - `description`
- Resultado actual: el modal crea producto con subset de datos y valores por defecto para los campos no expuestos.

### Conexión entre modal, acción y selección
- `ProductQuickForm` llama `createProduct` de `src/lib/actions/products.ts`.
- La acción `createProduct` valida con `productSchema` (`src/lib/validations/product.ts`) y delega al service.
- Al crear, `ProductQuickForm` retorna un `ProductOption` al `EntitySelectorModal`; este lo propaga a `onSelect` y cierra.
- El formulario de inventario guarda en estado local el producto recién creado y lo deja seleccionado.

## Code References
- `src/components/shared/EntitySelectorModal.tsx:46-51` - Contrato de `renderCreateForm`.
- `src/components/shared/EntitySelectorModal.tsx:71-79` - Estado de vista modal y reset al abrir.
- `src/components/shared/EntitySelectorModal.tsx:91-100` - `handleSelect` y `handleCreated`.
- `src/components/shared/EntitySelectorModal.tsx:134-144` - Botón para cambiar a vista de creación.
- `src/components/shared/EntitySelectorModal.tsx:167-171` - Render de formulario de creación.
- `src/features/products/components/ProductQuickForm.tsx:86-108` - Submit y payload enviado a `createProduct`.
- `src/features/products/components/ProductQuickForm.tsx:111-214` - Campos renderizados del quick form.
- `src/app/inventario/nuevo/inventory-item-form.tsx:129-139` - Integración de `ProductQuickForm` en `EntitySelectorModal`.
- `src/app/productos/product-form.tsx:124-334` - Campos del formulario completo de producto.
- `src/lib/validations/product.ts:3-14` - `productSchema` con shape validado.
- `src/lib/actions/products.ts:31-40` - Acción `createProduct` y parse con schema.

## Architecture Insights
- El patrón `EntitySelectorModal` centraliza selección + creación inline de entidades con vista `list/create`.
- La creación rápida de producto se implementa como formulario especializado (`ProductQuickForm`) distinto al formulario completo de módulo (`product-form.tsx`).
- El selector de inventario consume un contrato de item mínimo (`id`, `code`, `name`, `inventoryTracking`) para seleccionar inmediatamente el producto recién creado.

## Historical Context (from thoughts/)
- `thoughts/shared/research/2026-02-25_14-15-00_general_entity-selector-modal-v2-research.md` - Estado de transición del patrón v2 y contexto del quick form.
- `thoughts/shared/research/2026-02-26_13-05-41_[general]_inventario-unidad-vs-cantidad-estado-actual.md` - Referencias a `ProductQuickForm` y flujo de inventario.
- `thoughts/shared/research/2026-02-27_13-22-20_[general]_producto-codigo-cambia-al-editar-current-state.md` - Comportamiento de autofill de código en formularios de producto.

## Related Research
- `thoughts/shared/research/2026-02-24_15-47-32_[general]_product-code-autofill-by-category-current-state.md`
- `thoughts/shared/research/2026-02-24_22-00-00_general_entity-selector-modal-pattern-spec.md`
- `thoughts/shared/plans/2026-02-26_10-30-00_general_entity-selector-modal-v2.md`

## Open Questions
- No se identificaron otros flujos activos (además de inventario) con `allowCreate` para producto en modal dentro del código revisado.
- `gh` no está disponible en este entorno, por lo que este documento usa referencias locales de archivos/líneas y no permalinks de GitHub.
