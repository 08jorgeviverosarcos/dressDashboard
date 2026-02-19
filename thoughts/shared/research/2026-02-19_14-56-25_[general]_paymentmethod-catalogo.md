---
date: 2026-02-19T14:56:25-0500
researcher: gpt-5.3-codex
git_commit: bbde1a632bf15021a0e95f45a4aa17c36c66fbad
branch: main
repository: dressDashboard
topic: "Cambio de catalogo PaymentMethod (DB en ingles mayusculas + UI en espanol)"
tags: [research, codebase, payments, expenses, paymentmethod, prisma, zod, ui-labels]
status: complete
last_updated: 2026-02-19
last_updated_by: gpt-5.3-codex
---

# Research: Cambio de catalogo PaymentMethod (DB en ingles mayusculas + UI en espanol)

**Date**: 2026-02-19T14:56:25-0500  
**Researcher**: gpt-5.3-codex  
**Git Commit**: bbde1a632bf15021a0e95f45a4aa17c36c66fbad  
**Branch**: main  
**Repository**: dressDashboard

## Research Question
/research_codebase necesito que el enum `PaymentMethod` se modifique para conservar DB en ingles mayusculas y mantener UI en espanol. Valores solicitados por el usuario: `Bancolombia, Nequi, DaviPlata, Davivienda, Bold/Tarjeta, CrediBanco, Efectvo, Otro`.

## Summary
Actualmente `PaymentMethod` esta definido en Prisma con 5 valores (`CASH`, `TRANSFER`, `CARD`, `NEQUI`, `OTHER`) y ese mismo catalogo se replica en validaciones Zod, formularios, filtros y vistas de pagos/gastos.  
La UI traduce los valores de DB mediante `PAYMENT_METHOD_LABELS` en `src/lib/constants/categories.ts`, donde hoy se muestran etiquetas en espanol (`Efectivo`, `Transferencia`, `Tarjeta`, `Nequi`, `Otro`).

## Detailed Findings

### 1) Fuente de verdad en DB (Prisma enum)
- `prisma/schema.prisma:200-206` define `enum PaymentMethod` con:
  - `CASH`
  - `TRANSFER`
  - `CARD`
  - `NEQUI`
  - `OTHER`
- `Payment.paymentMethod` usa ese enum en `prisma/schema.prisma:117`.
- `Expense.paymentMethod` usa ese enum en `prisma/schema.prisma:137`.
- La migracion inicial tambien crea el tipo SQL `PaymentMethod` en `prisma/migrations/20260217163331_init/migration.sql`.

### 2) Validacion de entrada (Zod)
- `src/lib/validations/payment.ts:8` valida `paymentMethod` con `z.enum(["CASH", "TRANSFER", "CARD", "NEQUI", "OTHER"])`.
- `src/lib/validations/expense.ts:11` valida `paymentMethod` con el mismo enum.
- Esto acopla los formularios al catalogo actual de DB.

### 3) Mapeo para UI en espanol
- `src/lib/constants/categories.ts:78-84` define:
  - `CASH: "Efectivo"`
  - `TRANSFER: "Transferencia"`
  - `CARD: "Tarjeta"`
  - `NEQUI: "Nequi"`
  - `OTHER: "Otro"`
- El patron de render usa fallback:
  - `PAYMENT_METHOD_LABELS[value] ?? value`
  - aparece en tablas y detalles.

### 4) Formularios que envian valores de enum
- `src/components/orders/PaymentDialog.tsx`
  - default: `paymentMethod: "CASH"` (`:53`)
  - opciones: `Object.entries(PAYMENT_METHOD_LABELS)` (`:147-150`)
- `src/components/expenses/ExpenseForm.tsx`
  - default: `paymentMethod: "CASH"` (`:88`)
  - edicion usa `initialData.paymentMethod` (`:77`)
  - opciones: `Object.entries(PAYMENT_METHOD_LABELS)` (`:209-211`)
- En ambos casos: `value` del select es clave enum (DB), label es texto espanol.

### 5) Listados y detalle donde se visualiza metodo de pago
- Pagos:
  - `src/app/pagos/payments-table.tsx:104` columna "Metodo" renderiza label.
  - `src/app/pagos/payments-table.tsx:45` filtro usa `Object.keys(PAYMENT_METHOD_LABELS)`.
  - `src/app/pagos/[id]/page.tsx:46` detalle renderiza label.
  - `src/components/orders/PaymentTimeline.tsx:50` timeline renderiza label.
- Gastos:
  - `src/app/gastos/gastos-table.tsx:77` columna "Metodo" renderiza label.
  - `src/app/gastos/[id]/page.tsx:61` detalle renderiza label.

### 6) Flujo de filtros/queries con paymentMethod
- `src/app/pagos/page.tsx:13` pasa `searchParams.method` a `getPayments`.
- `src/lib/actions/payments.ts:12-16` recibe `paymentMethod?: string`.
- `src/features/payments/payments.repo.ts:14` aplica `where.paymentMethod = filters.paymentMethod`.
- El modulo de gastos no expone filtro por `paymentMethod` en su listado actual.

### 7) Persistencia y seed con catalogo actual
- `prisma/seed.ts` inserta pagos/gastos con valores actuales:
  - `TRANSFER` (`:225`, `:279`, `:377`, `:387`, `:428`)
  - `NEQUI` (`:233`, `:357`)
  - `CASH` (`:240`, `:397`, `:408`)
  - `CARD` (`:418`, `:438`)

## Code References
- `prisma/schema.prisma:200-206` - Definicion de `enum PaymentMethod`.
- `prisma/schema.prisma:111-118` - Modelo `Payment` con `paymentMethod`.
- `prisma/schema.prisma:128-138` - Modelo `Expense` con `paymentMethod`.
- `src/lib/constants/categories.ts:78-84` - `PAYMENT_METHOD_LABELS` (DB -> espanol).
- `src/lib/validations/payment.ts:8` - Enum de metodos en schema de pago.
- `src/lib/validations/expense.ts:11` - Enum de metodos en schema de gasto.
- `src/components/orders/PaymentDialog.tsx:53` - Default `CASH` en formulario de pagos.
- `src/components/expenses/ExpenseForm.tsx:88` - Default `CASH` en formulario de gastos.
- `src/app/pagos/payments-table.tsx:45` - Fuente de opciones de filtro por metodo.
- `src/app/pagos/payments-table.tsx:104` - Render label en tabla de pagos.
- `src/app/gastos/gastos-table.tsx:77` - Render label en tabla de gastos.
- `src/components/orders/PaymentTimeline.tsx:50` - Render label en timeline.

## Architecture Insights
- `PaymentMethod` tiene un patron "clave interna + label visible":
  - Clave interna: enum Prisma (en ingles mayuscula).
  - Label visible: mapa de labels en `categories.ts` (espanol).
- El catalogo esta duplicado de forma consistente en 3 capas:
  1. Prisma enum (`schema.prisma`)
  2. Validaciones (`payment.ts`, `expense.ts`)
  3. Presentacion (`PAYMENT_METHOD_LABELS` + formularios/tablas)
- `payments-table` deriva filtros desde `Object.keys(PAYMENT_METHOD_LABELS)`, por lo que el catalogo visual sale de ese mapa.

## Historical Context (from thoughts/)
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md`
  - Documenta `paymentMethod` en `Expense` y el uso de Zod enum en gastos.
- `thoughts/shared/research/2026-02-19_00-00-00_[general]_patron-modulos-tabla.md`
  - Documenta que `pagos` tiene filtros por metodo y fechas.
- `thoughts/shared/plans/2026-02-19_16-00-00_[general]_estandarizacion-patron-modulos-tabla.md`
  - Referencia uso de `PAYMENT_METHOD_LABELS` en detalle/listados.

## Related Research
- `thoughts/shared/research/2026-02-19_09-00-00_general_expense-to-orderitem-migration.md`
- `thoughts/shared/research/2026-02-19_00-00-00_[general]_patron-modulos-tabla.md`
- `thoughts/shared/research/2026-02-18_18-30-00_general_rentals-module-analysis.md`

## Open Questions
- Confirmar las claves internas (DB, ingles mayuscula) esperadas para cada label solicitado:
  - Bancolombia
  - Nequi
  - DaviPlata
  - Davivienda
  - Bold/Tarjeta
  - CrediBanco
  - Efectvo
  - Otro
- Confirmar ortografia del label visible: el requerimiento actual trae `Efectvo` (sin `i`).
- `gh` CLI no esta disponible en este entorno, por lo que este reporte usa referencias locales `archivo:linea` en lugar de permalinks de GitHub.
