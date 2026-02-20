---
date: 2026-02-19T17:01:20-05:00
researcher: gpt-5.3-codex
git_commit: fa0a89d163b78ca293f28f151de81ef01cba2dfc
branch: main
repository: dressDashboard
topic: "Refactor Rentals that rentals are associated with OrderItem instead of Order. Add a 1:1 optional relation between OrderItem and Rental. and it coud be optional"
tags: [research, codebase, rentals, orders, orderitem, prisma]
status: complete
last_updated: 2026-02-19
last_updated_by: gpt-5.3-codex
---

# Research: Rental asociado a OrderItem (1:1 opcional)

**Date**: 2026-02-19T17:01:20-05:00  
**Researcher**: gpt-5.3-codex  
**Git Commit**: fa0a89d163b78ca293f28f151de81ef01cba2dfc  
**Branch**: main  
**Repository**: dressDashboard

## Research Question

Documentar el estado actual del código para el escenario: mover la asociación de `Rental` desde `Order` hacia `OrderItem`, con una relación `1:1` opcional entre `OrderItem` y `Rental`.

## Summary

Hoy, `Rental` está modelado como extensión `1:1` de `Order` mediante `Rental.orderId @unique`, y `OrderItem` no tiene relación directa con `Rental`.  
El flujo de alquiler (consulta, creación, actualización y costos) usa `orderId` como eje en schema, repositorios, servicios, server actions y páginas de UI.  
No existe implementación actual de `Rental -> OrderItem`; en `thoughts/` sí existe un patrón comparable ya documentado para `Expense -> OrderItem` (N:1 opcional), usado como contexto histórico.

## Detailed Findings

### 1) Modelo de datos actual en Prisma

- `Order` expone `items: OrderItem[]` y `rental: Rental?`, consolidando `Order -> OrderItem` (1:N) y `Order -> Rental` (0..1).  
  ([prisma/schema.prisma:81-84](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/prisma/schema.prisma#L81-L84))
- `OrderItem` referencia `Order` con `orderId` requerido y `onDelete: Cascade`; no define campo relacional hacia `Rental`.  
  ([prisma/schema.prisma:102-104](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/prisma/schema.prisma#L102-L104))
- `Rental` usa `orderId String @unique` y relación requerida a `Order`; esto fija una cardinalidad 1:1 con `Order`.  
  ([prisma/schema.prisma:148-156](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/prisma/schema.prisma#L148-L156))
- `RentalCost` depende de `Rental` con `onDelete: Cascade` (al borrar rental, se borran sus costos).  
  ([prisma/schema.prisma:166-167](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/prisma/schema.prisma#L166-L167))

### 2) Flujo de rentals en acciones/servicios/repositorios

- La lectura de alquiler se hace por `orderId` (`getRental(orderId)`), no por `orderItemId`.  
  (`src/lib/actions/rentals.ts`, `src/features/rentals/rentals.service.ts`, `src/features/rentals/rentals.repo.ts`)
- El repo busca por `orderId` y trae `order` completo con `client` e `items`.  
  ([src/features/rentals/rentals.repo.ts:3-16](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/src/features/rentals/rentals.repo.ts#L3-L16))
- La creación valida unicidad por `orderId` (`findByOrderIdSimple`) y retorna error `"Este pedido ya tiene un alquiler asociado"` si ya existe.  
  ([src/features/rentals/rentals.service.ts:9-27](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/src/features/rentals/rentals.service.ts#L9-L27))
- En actualización, al registrar `actualReturnDate` por primera vez, se recorren los `items` del `order` del rental para actualizar inventario.  
  ([src/features/rentals/rentals.service.ts:34-58](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/src/features/rentals/rentals.service.ts#L34-L58))
- Los costos del alquiler (`RentalCost`) usan `rentalId` y no tocan `OrderItem` directamente.  
  ([src/lib/actions/rentals.ts:40-61](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/src/lib/actions/rentals.ts#L40-L61))

### 3) Borrado y relación entre módulos

- El borrado de `Order` elimina `Payment`, luego `Rental` (si existe), y finalmente `Order`; la eliminación de `RentalCost` ocurre en cascada por FK.  
  ([src/features/orders/orders.repo.ts:155-164](https://github.com/08jorgeviverosarcos/dressDashboard/blob/fa0a89d163b78ca293f28f151de81ef01cba2dfc/src/features/orders/orders.repo.ts#L155-L164))
- La razón operativa de borrar `Rental` antes de `Order` está alineada con que `Rental` depende hoy de `orderId` requerido.

### 4) UI y rutas que consumen el flujo actual

- La pantalla de alquiler cuelga de la ruta de pedido (`/pedidos/[id]/alquiler`) y recibe `id` como `orderId`.  
  (`src/app/pedidos/[id]/alquiler/page.tsx`, `src/app/pedidos/[id]/alquiler/rental-manager.tsx`)
- El módulo de pedidos también consume el estado rental desde el detalle de pedido.  
  (`src/app/pedidos/[id]/page.tsx`, `src/app/pedidos/[id]/order-actions.tsx`)

## Code References

- `prisma/schema.prisma:81-84` - Relación inversa de `Order` hacia `OrderItem[]` y `Rental?`.
- `prisma/schema.prisma:102-104` - FK `OrderItem.orderId` con `onDelete: Cascade`.
- `prisma/schema.prisma:148-156` - `Rental.orderId @unique` y relación requerida a `Order`.
- `prisma/schema.prisma:166-167` - `RentalCost -> Rental` con `onDelete: Cascade`.
- `src/lib/actions/rentals.ts:8-61` - Actions de consulta/creación/actualización/costos para rental.
- `src/features/rentals/rentals.service.ts:5-94` - Reglas de negocio actuales de rental y costos.
- `src/features/rentals/rentals.repo.ts:3-90` - Queries Prisma de rental/rentalCost.
- `src/features/orders/orders.repo.ts:155-164` - Borrado en cascada manual de `Order` + `Rental`.
- `src/app/pedidos/[id]/alquiler/page.tsx` - Entrada de UI del módulo de alquiler por `orderId`.
- `src/app/pedidos/[id]/alquiler/rental-manager.tsx` - Gestión de formulario/costos de rental.

## Architecture Insights

- La estructura sigue `actions -> services -> repositories` para rentals y orders.
- `Rental` funciona como extensión especializada del contexto de `Order`.
- `OrderItem` participa en inventario/costos de pedidos, pero no es propietario del registro `Rental`.
- La cardinalidad actual de alquiler está definida por unicidad en `Rental.orderId`.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`  
  Documenta el estado actual de rentals como `Order (1) -> Rental (0..1)` y flujo asociado.
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md`  
  Documenta un patrón de migración ya realizado de `Expense` desde `Order` hacia `OrderItem` (N:1 opcional), útil como antecedente técnico del tipo de cambio de asociación.
- `thoughts/shared/plans/2026-02-19_16-00-00_[general]_estandarizacion-patron-modulos-tabla.md`  
  Resume impactos de cascadas y dependencias entre `Order`, `OrderItem`, `Rental`, `Expense`.

## Related Research

- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md`
- `thoughts/shared/research/2026-02-19_00-00-00_[general]_patron-modulos-tabla.md`

## Open Questions

- ¿El alcance deseado para `Rental -> OrderItem (1:1 opcional)` aplica a todos los flujos actuales de rental o solo a nuevas órdenes?
- ¿La asociación esperada será por un `OrderItem` específico de tipo renta, o por cualquier item elegible del pedido?
- ¿Se mantendrá compatibilidad de lectura para datos históricos ligados por `orderId` durante transición?
