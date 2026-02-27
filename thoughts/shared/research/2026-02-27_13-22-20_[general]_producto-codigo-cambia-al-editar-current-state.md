---
date: 2026-02-27T13:22:20-0500
researcher: Cursor AI (gpt-5.3-codex)
git_commit: 04bfc314745701c551145030328c01a6dcbfe9c4
branch: main
repository: dressDashboard
topic: "Producto: el código cambia automáticamente al abrir edición (NO-005 -> NO-006)"
tags: [research, codebase, products, product-form, product-code, edit-flow]
status: complete
last_updated: 2026-02-27
last_updated_by: Cursor AI (gpt-5.3-codex)
---

# Research: Producto cambia código al editar

**Date**: 2026-02-27T13:22:20-0500  
**Researcher**: Cursor AI (gpt-5.3-codex)  
**Git Commit**: 04bfc314745701c551145030328c01a6dcbfe9c4  
**Branch**: main  
**Repository**: dressDashboard

## Research Question

Al editar un producto, el código guardado (ej. `NO-005`) cambia automáticamente al abrir el formulario a `NO-006` sin interacción del usuario.

## Summary

El formulario de edición carga correctamente el código existente desde `initialData.code`, pero durante el montaje se ejecuta un `useEffect` que solicita un código sugerido por categoría y aplica `form.setValue("code", suggestedCode)`.  
Como en edición el producto ya tiene `categoryId` y la bandera de edición manual (`hasManualCodeEdit`) inicia en `false`, el efecto sobrescribe el valor inicial inmediatamente.  
El servicio de sugerencia calcula `max + 1` de los códigos existentes de la categoría, por eso un producto `NO-005` termina visualizándose como `NO-006` al abrir edición.

## Detailed Findings

### Entrada a edición y carga inicial del producto

- El detalle de producto navega a edición con `Link href={`/productos/${id}/editar`}` en `src/app/productos/[id]/page.tsx`.
- La página de edición (`src/app/productos/[id]/editar/page.tsx`) carga `product` y `categories`, y pasa `initialData` a `ProductForm`.
- En ese `initialData`, el campo `code` se asigna explícitamente como `product.code`.

### Inicialización del formulario

- `ProductForm` (`src/app/productos/product-form.tsx`) usa React Hook Form con `defaultValues: initialData`.
- Por lo tanto, en edición el valor inicial del input `code` sí parte del código guardado.

### Punto exacto donde se sobrescribe el código

- En el mismo `ProductForm`, un `useEffect` depende de `selectedCategoryId`.
- Si existe categoría y no hay edición manual previa de código (`hasManualCodeEdit.current === false`), llama a `getSuggestedProductCode(selectedCategoryId)`.
- Al resolver, aplica `form.setValue("code", result.data.code, ...)`, lo que reemplaza el código inicial.

### Cómo se calcula el código sugerido

- `getSuggestedProductCode` (server action) delega en `products.service.ts`.
- El servicio toma el prefijo desde el código de categoría (ej. `NO`), consulta todos los códigos de productos activos con ese prefijo y categoría, detecta el máximo secuencial y retorna `max + 1` con padding a 3 dígitos.
- En consecuencia, si existe `NO-005`, la sugerencia resultante es `NO-006`.

### Persistencia del cambio al guardar

- En submit de edición, `updateProduct(id, data)` envía el `code` actual del formulario.
- El servicio/repo de update usa ese `parsed.code` para actualizar la entidad, por lo que si el usuario guarda, persiste el código ya sobrescrito.

## Code References

- `src/app/productos/[id]/page.tsx:29-33` - Navegación al formulario de edición.
- `src/app/productos/[id]/editar/page.tsx:13-33` - Carga de datos y `initialData` con `code: product.code`.
- `src/app/productos/product-form.tsx:57-70` - `defaultValues` del formulario usando `initialData`.
- `src/app/productos/product-form.tsx:76-96` - `useEffect` que solicita y aplica código sugerido.
- `src/app/productos/product-form.tsx:88-93` - `form.setValue("code", result.data.code, ...)`.
- `src/app/productos/product-form.tsx:138-143` - Flag `hasManualCodeEdit` solo se activa al escribir manualmente.
- `src/lib/actions/products.ts:21-30` - Action `getSuggestedProductCode`.
- `src/features/products/products.service.ts:22-49` - Cálculo de siguiente secuencia por categoría/prefijo.
- `src/features/products/products.repo.ts:58-67` - Consulta de códigos existentes por categoría/prefijo.
- `src/features/products/products.service.ts:77-101` - Update que persiste `parsed.code`.

## Architecture Insights

- La generación de sugerencia de código está implementada como:
  - UI (`ProductForm`) decide cuándo pedir sugerencia.
  - Server Action (`getSuggestedProductCode`) valida y delega.
  - Service (`products.service.ts`) calcula secuencia.
  - Repo (`products.repo.ts`) recupera códigos fuente para el cálculo.
- El comportamiento de autocompletar código se reutiliza también en `ProductQuickForm` con lógica equivalente de `useEffect` y bandera de edición manual.
- El flujo mantiene la arquitectura del proyecto (UI -> Action -> Service -> Repo) sin rutas API.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-24_15-47-32_[general]_product-code-autofill-by-category-current-state.md` - Investigación previa sobre autollenado de código por categoría.
- `thoughts/shared/research/2026-02-26_13-05-41_[general]_inventario-unidad-vs-cantidad-estado-actual.md` - Contexto del dominio producto/inventario y menciones de código de producto.
- `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md` - Estado actual de automatizaciones alrededor de inventario.
- `thoughts/shared/research/2026-02-25_13-39-25_[general]_pedidos-estado-automatizaciones-current-state.md` - Automatizaciones actuales (pedido), útil como contraste de comportamientos automáticos.

## Related Research

- `thoughts/shared/research/2026-02-24_15-47-32_[general]_product-code-autofill-by-category-current-state.md`
- `thoughts/shared/research/2026-02-26_13-05-41_[general]_inventario-unidad-vs-cantidad-estado-actual.md`
- `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`
- `thoughts/shared/research/2026-02-25_13-39-25_[general]_pedidos-estado-automatizaciones-current-state.md`

## Open Questions

- Si este flujo debe mantener autogeneración también en edición o solo en creación.
- Si debe existir una condición explícita de modo edición antes de aplicar sugerencia automática.
- Si el autocompletado debe ejecutarse únicamente cuando cambia la categoría por acción del usuario.

