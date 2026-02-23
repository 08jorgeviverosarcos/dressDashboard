---
date: 2026-02-22T21:27:06-0500
researcher: Cursor AI
git_commit: 2c870f1f95a17815d147afb6d322a23944ecdf62
branch: main
repository: dressDashboard
topic: "Estado actual de inputs de dinero y uso de mask monetario"
tags: [research, codebase, money-inputs, orders, payments, expenses, rentals, products]
status: complete
last_updated: 2026-02-22
last_updated_by: Cursor AI
---

# Research: Estado actual de inputs de dinero y uso de mask monetario

**Date**: 2026-02-22T21:27:06-0500  
**Researcher**: Cursor AI  
**Git Commit**: `2c870f1f95a17815d147afb6d322a23944ecdf62`  
**Branch**: `main`  
**Repository**: `dressDashboard`

## Research Question

Quiero que todos los inputs donde se manejen valores de dinero usen un mask para que el usuario vea formato dinero (ej. `$500.000`) aunque en base de datos se guarde `500000`.

## Summary

Hoy, los inputs monetarios del sistema no usan mask de moneda en la captura.  
El patrón actual es `Input type="number"` + parseo a `number` (`Number(e.target.value)` o `valueAsNumber`) y validacion Zod en la capa de actions (excepto create/update rental, que pasan directo a service).  
El formato de moneda (`$...`) se aplica principalmente en visualizacion con `formatCurrency`, no durante la escritura en inputs.

## Detailed Findings

### 1) Estado actual de mask monetario

- No se encontraron implementaciones de mask monetario (`react-number-format`, `NumericFormat`, `inputmask`, `mask`) en el repositorio.
- Los campos de dinero se capturan con `type="number"` en formularios de pedidos, pagos, gastos, productos y rentals.

### 2) Inputs monetarios en formularios

#### Pedidos
- `src/components/orders/OrderForm.tsx`
  - `adjustmentAmount` y `% de abono minimo` usan `type="number"` y `Number(e.target.value)`.
  - Calcula `totalPrice` y `totalCost` en UI y los envia en payload.
- `src/components/orders/OrderItemRow.tsx`
  - `unitPrice`, `costAmount`, `discountValue` usan `type="number"` + `Number(e.target.value)`.
  - Subtotal por item se calcula en UI y se muestra con `formatCurrency`.
- `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx`
  - `unitPrice`, `costAmount`, `discountValue` usan `type="number"` + `Number(e.target.value)`.

#### Pagos
- `src/components/orders/PaymentDialog.tsx`
  - `amount` usa `type="number"` con React Hook Form (`valueAsNumber: true`).

#### Gastos
- `src/components/expenses/ExpenseForm.tsx`
  - `amount` usa `type="number"` + `Number(e.target.value)`.

#### Productos
- `src/app/productos/product-form.tsx`
  - `salePrice`, `rentalPrice`, `cost` usan `type="number"`.
  - Convierte a `Number(...)` o `null` si el input esta vacio.

#### Rentals (detalle de item)
- `src/app/pedidos/[id]/items/[itemId]/rental-manager.tsx`
  - `deposit` y `costAmount` usan `type="number"` + `Number(e.target.value)`.

### 3) Flujo de datos monetarios (captura a persistencia)

1. UI captura como numero en input (`type="number`").
2. Parseo en cliente (`Number(...)` o `valueAsNumber`).
3. Submit a server action.
4. Validacion Zod en actions donde aplica.
5. Service orquesta reglas de negocio.
6. Repo persiste con Prisma en campos `Decimal`.

La base de datos guarda valores numericos/decimales (no strings formateados).

### 4) Validaciones monetarias actuales (Zod)

- `src/lib/validations/order.ts`
  - `unitPrice`, `discountValue`, `costAmount`, `totalPrice`, `totalCost`, `adjustmentAmount`.
- `src/lib/validations/payment.ts`
  - `amount` debe ser positivo.
- `src/lib/validations/expense.ts`
  - `amount` debe ser positivo.
- `src/lib/validations/product.ts`
  - `salePrice`, `rentalPrice`, `cost` son opcionales/nullables y `>= 0`.
- `src/lib/validations/rental.ts`
  - `deposit >= 0` y `rentalCost.amount > 0`.

### 5) Formato monetario actual en visualizacion

- `src/lib/utils.ts`
  - `formatCurrency(...)` usa `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" })`.
  - `toDecimalNumber(...)` convierte `Decimal/string/number` a `number`.
- `src/components/shared/CurrencyDisplay.tsx`
  - Wrapper para renderizar moneda formateada.

Esto confirma que el formato `$...` esta estandarizado para lectura/visualizacion, no para escritura en inputs.

## Code References

- `src/components/orders/OrderForm.tsx:202-260` - Inputs numericos de ajuste y porcentaje; parseo a numero.
- `src/components/orders/OrderItemRow.tsx:133-225` - Inputs monetarios y descuento con `type="number"`.
- `src/components/orders/PaymentDialog.tsx:104-114` - Input de `amount` con `valueAsNumber`.
- `src/components/expenses/ExpenseForm.tsx:125-133` - Input de `amount` con parseo a `Number`.
- `src/app/productos/product-form.tsx:164-214` - Inputs de precio/costo numericos.
- `src/app/pedidos/[id]/items/[itemId]/rental-manager.tsx:144-263` - Inputs de `deposit` y costo rental.
- `src/lib/validations/order.ts` - Reglas monetarias de pedido/item.
- `src/lib/validations/payment.ts` - Regla `amount > 0`.
- `src/lib/validations/expense.ts` - Regla `amount > 0`.
- `src/lib/validations/product.ts` - Reglas de precios/costo de producto.
- `src/lib/validations/rental.ts` - Reglas de deposito y costo de alquiler.
- `src/lib/utils.ts:11-19` - `formatCurrency`.
- `src/lib/utils.ts:33-37` - `toDecimalNumber`.
- `prisma/schema.prisma` - Campos monetarios modelados como `Decimal`.

## Architecture Insights

- El formateo de moneda existe como utilidad de presentacion (`formatCurrency`) y se usa en componentes de lectura.
- La captura de montos en formularios sigue un patron uniforme basado en `type="number"` y conversion a `number`.
- El sistema separa representacion de UI (formato moneda) de persistencia (valor numerico decimal).

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
  - Documenta el estado de `chargedIncome`, `adjustmentAmount` y `deposit` en el momento de esa investigacion.
- `thoughts/shared/research/2026-02-22_15-54-15_[general]_testing-strategy-codebase-analysis.md`
  - Cubre pruebas/flujo de calculos financieros (`calculateOrderProfit`, `calculatePaidAmount`, `toDecimalNumber`).
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
  - Describe flujo de items con descuentos y campos monetarios de OrderItem.
- `thoughts/shared/plans/2026-02-20_16-17-59_[general]_order-adjustment-rental-deposit.md`
  - Contexto historico de plan para cambios financieros (documento de plan, no estado vigente).

## Related Research

- `thoughts/shared/research/2026-02-20_15-48-09_[general]_rental-chargedincome-adjustment-deposit-current-state.md`
- `thoughts/shared/research/2026-02-22_15-54-15_[general]_testing-strategy-codebase-analysis.md`
- `thoughts/shared/research/2026-02-20_17-56-38_[general]_orderitem-type-discount-rental-flow.md`
- `thoughts/shared/research/2026-02-20_17-02-13_[general]_orderitem-detail-view-rental-inline-refactor.md`
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`

## Open Questions

- Alcance exacto esperado para "todos los inputs de dinero" respecto a campos porcentuales (ej. `% abono minimo`) y campos numericos no monetarios.
- Definicion del formato final esperado durante escritura (solo miles y simbolo `$`, o tambien decimales/caret behavior).
