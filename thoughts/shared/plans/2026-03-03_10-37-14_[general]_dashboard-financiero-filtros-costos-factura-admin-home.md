# Dashboard Financiero + Costos en Vista Factura (sin PDF) + Admin only en Home — Implementation Plan

## Overview

Implementar tres ajustes coordinados sobre el flujo actual:  
1) Exponer filtros de periodo (mes o rango de fechas) en el home financiero (`/`),  
2) Mostrar costos de forma explícita en la vista operativa equivalente a factura (detalle de pedido, sin PDF/impresión),  
3) Restringir únicamente el home financiero (`/`) al rol `ADMIN`.

## Current State Analysis

- El home dashboard ya renderiza KPIs financieros (`Ingresos`, `Gastos`, `Flujo Neto`, `Ganancia`) en `src/app/(dashboard)/page.tsx`.
- Los cálculos financieros ya existen en `src/features/dashboard/dashboard.service.ts` y repositorio `src/features/dashboard/dashboard.repo.ts`.
- La action `getDashboardData(startDate?, endDate?)` ya acepta rango de fechas en `src/lib/actions/dashboard.ts`, pero `page.tsx` lo llama sin parámetros.
- El patrón de filtros por URL ya está implementado en pagos: `src/app/(dashboard)/pagos/page.tsx` + `src/app/(dashboard)/pagos/payments-table.tsx`.
- La vista operativa equivalente a factura hoy es el detalle de pedido `src/app/(dashboard)/pedidos/[id]/page.tsx` (con resumen de total/pagado/restante/ganancia-costo) y su tabla `order-items-table.tsx`.
- La autorización por rol ADMIN ya existe como patrón en `proxy.ts`, `src/lib/dal.ts`, `src/lib/actions/auth.ts`, y `src/app/(dashboard)/usuarios/page.tsx`.

### Key Discoveries

- `src/app/(dashboard)/page.tsx` consume `getDashboardData()` sin filtros de query.
- `src/features/dashboard/dashboard.service.ts` ya soporta periodo dinámico para KPIs y usa series mensuales fijas para gráfica de 6 meses.
- `src/app/(dashboard)/pedidos/[id]/order-items-table.tsx` ya tiene columna `Costo`, pero está oculta en mobile (`hidden md:table-cell`).
- `src/app/(dashboard)/pedidos/[id]/page.tsx` ya calcula y muestra `Costo`/`Ganancia` global del pedido.
- `proxy.ts` actualmente restringe `/usuarios` para no-admin; no restringe `/`.

## Desired End State

1. Home financiero (`/`) solo accesible por usuarios `ADMIN`.
2. Home financiero con filtros por periodo:
   - selección por mes (ej. febrero/marzo),
   - o rango personalizado (`startDate`, `endDate`).
3. Los KPIs (`Ingresos`, `Gastos`, `Flujo Neto`, `Ganancia`) cambian según el filtro aplicado.
4. La vista operativa de factura (detalle de pedido) deja explícito el costo:
   - costo total del pedido visible,
   - costo por item visible en tabla de items también en mobile (sin depender solo de `md`).
5. Se preserva comportamiento financiero existente (mismas fórmulas y fuentes de datos).

### Verification

- [ ] `SALES` al entrar a `/` es redirigido a `/pedidos`.
- [ ] `ADMIN` entra a `/` sin restricción.
- [ ] Filtro por mes y por rango modifica valores de KPI de forma consistente.
- [ ] Sin filtros, el home mantiene comportamiento de mes actual.
- [ ] En `/pedidos/[id]` se ve costo total y costo por item en desktop y mobile.

## What We're NOT Doing

- No crear módulo de factura PDF/impresión.
- No cambiar fórmulas de negocio de KPIs existentes.
- No restringir por rol módulos distintos al home financiero (`/`).
- No modificar schema Prisma ni migraciones para este alcance.
- No introducir nuevas librerías para filtros o permisos.

## Implementation Approach

Aplicar cambios en 4 fases para aislar riesgos:
1) Guard de autorización para `/`,  
2) Filtros de periodo en home financiero (UI + wiring),  
3) Ajustes de visualización de costos en detalle de pedido,  
4) Validación de no-regresión financiera y responsive.

---

## Phase 1: Restricción ADMIN solo en Home Financiero

### Overview

Aplicar autorización de rol únicamente a ruta `/` manteniendo acceso actual para el resto del dashboard.

### Changes Required

#### 1. Ajustar `proxy.ts` para proteger `/` por rol
**File**: `proxy.ts`  
**Changes**:
- Agregar condición explícita: si `path === "/"` y `session.role !== "ADMIN"`, redirigir a `/pedidos`.
- Mantener intacta la lógica existente de `/login` y `/usuarios`.

#### 2. Guard defensivo en página home
**File**: `src/app/(dashboard)/page.tsx`  
**Changes**:
- Al inicio del server component, usar `verifySession()` de `src/lib/dal.ts`.
- Si `role !== "ADMIN"`, `redirect("/pedidos")`.
- Este guard replica el patrón de `src/app/(dashboard)/usuarios/page.tsx` para defensa en profundidad.

### Success Criteria

#### Automated Verification
- [ ] Typecheck sin errores: `npm run typecheck`
- [ ] Lint sin errores: `npm run lint`
- [ ] Build compila: `npm run build`

#### Manual Verification
- [ ] Usuario `SALES` navegando a `/` termina en `/pedidos`.
- [ ] Usuario `ADMIN` sigue viendo home financiero.
- [ ] Rutas no objetivo (`/pedidos`, `/pagos`, `/gastos`) mantienen acceso actual.

**Implementation Note**: confirmar manualmente esta fase antes de continuar.

---

## Phase 2: Filtros de Periodo en Home Financiero

### Overview

Conectar filtros por URL en home (`month`, `startDate`, `endDate`) reutilizando patrón ya existente en pagos.

### Changes Required

#### 1. Extender query params en `page.tsx`
**File**: `src/app/(dashboard)/page.tsx`  
**Changes**:
- Cambiar firma de page para recibir `searchParams`.
- Parsear:
  - `month` (formato acordado, p. ej. `YYYY-MM`),
  - `startDate`,
  - `endDate`.
- Resolver periodo efectivo:
  - si hay `startDate/endDate`, priorizar rango;
  - si hay `month`, construir primer/último día de ese mes;
  - fallback: comportamiento actual (mes vigente).
- Llamar `getDashboardData(start, end)` con fechas calculadas.

#### 2. Agregar barra de filtros en home (client component)
**File**: `src/app/(dashboard)/dashboard-filters.tsx` (nuevo)  
**Changes**:
- Componente cliente con `useRouter`, `usePathname`, `useSearchParams`.
- Inputs:
  - selector de mes (`type="month"`),
  - `startDate` y `endDate` (`type="date"`),
  - acción limpiar.
- Persistir filtros por query params con `router.replace(...)`.
- Seguir patrón de `payments-table.tsx` y reglas responsive (`flex-wrap`, base mobile).

#### 3. Integrar filtros en home
**File**: `src/app/(dashboard)/page.tsx`  
**Changes**:
- Renderizar `<DashboardFilters />` arriba de KPIs.
- Mantener el resto de bloques (charts/top products/upcoming/recent/inventory) intactos.

#### 4. Mantener contratos action/service/repo
**Files**:
- `src/lib/actions/dashboard.ts`
- `src/features/dashboard/dashboard.service.ts`
- `src/features/dashboard/dashboard.repo.ts`

**Changes**:
- No alterar fórmulas de negocio.
- Solo ajustes menores de tipado si son necesarios para el nuevo wiring.

### Success Criteria

#### Automated Verification
- [ ] Typecheck sin errores: `npm run typecheck`
- [ ] Lint sin errores: `npm run lint`
- [ ] Build compila: `npm run build`

#### Manual Verification
- [ ] Sin query params, KPIs mantienen comportamiento de mes actual.
- [ ] Cambiar `month` actualiza KPIs y conserva navegación SSR.
- [ ] Cambiar `startDate/endDate` actualiza KPIs correctamente.
- [ ] “Limpiar filtros” vuelve a estado por defecto.
- [ ] UI de filtros funciona en mobile (sin desbordes).

**Implementation Note**: validar manualmente con al menos 2 meses distintos y un rango custom.

---

## Phase 3: Mostrar Costos en Vista Operativa de Factura (Detalle Pedido)

### Overview

Hacer más explícita la visualización de costos en la vista de detalle de pedido, sin alterar cálculo de negocio.

### Changes Required

#### 1. Resumen financiero del pedido: costo total explícito
**File**: `src/app/(dashboard)/pedidos/[id]/page.tsx`  
**Changes**:
- En tarjetas de resumen, asegurar que `Costo Total` esté siempre visible como métrica dedicada (no solo alternando con ganancia según estado).
- Preservar cálculo actual de `profit` y totales.

#### 2. Tabla de items: costo visible también en mobile
**File**: `src/app/(dashboard)/pedidos/[id]/order-items-table.tsx`  
**Changes**:
- Ajustar visibilidad responsive de columna `Costo` para que sea visible en mobile (o incluir costo en una celda compacta del bloque principal de la fila).
- Mantener estructura DataTable y acciones existentes.
- No cambiar lógica de subtotal/descuento.

#### 3. Coherencia visual con costos vinculados
**File**: `src/app/(dashboard)/pedidos/[id]/page.tsx`  
**Changes**:
- Mantener bloque “Gastos Vinculados” existente; revisar solo etiquetas para consistencia de lenguaje con costos mostrados.

### Success Criteria

#### Automated Verification
- [ ] Typecheck sin errores: `npm run typecheck`
- [ ] Lint sin errores: `npm run lint`

#### Manual Verification
- [ ] En `/pedidos/[id]` se ve costo total del pedido claramente.
- [ ] En tabla de items se ve costo por item en desktop y mobile.
- [ ] Ganancia sigue mostrando el mismo valor que antes para pedidos `COMPLETED`.
- [ ] No hay regresiones en navegación a detalle de item ni acciones de eliminar.

**Implementation Note**: confirmar en al menos un pedido `COMPLETED` y uno no completado.

---

## Phase 4: Verificación Integral y No-Regresión

### Overview

Cerrar cambios validando permisos, cálculos y experiencia responsive.

### Testing Strategy

#### Automated Verification
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

#### Manual Verification
- [ ] Matriz de roles:
  - `ADMIN` -> `/` permitido,
  - `SALES` -> `/` redirige a `/pedidos`.
- [ ] Filtros home:
  - `month` funcional,
  - `startDate/endDate` funcional,
  - limpiar filtros funcional.
- [ ] KPIs financieros conservan fórmulas:
  - ingresos = suma pagos,
  - gastos = suma expenses,
  - flujo neto = ingresos - gastos,
  - ganancia = suma (`totalPrice - totalCost`) en completados.
- [ ] Vista detalle pedido:
  - costo total explícito,
  - costo por item visible también en mobile.

## Performance Considerations

- No se agregan queries nuevas pesadas; se reutiliza pipeline actual de dashboard.
- El filtrado sigue siendo server-side vía `searchParams` + SSR, consistente con patrón del repo.

## Migration Notes

- Sin migraciones de DB para este alcance.
- Sin cambios de contratos públicos fuera del home dashboard.

## References

- Research base: `thoughts/shared/research/2026-03-03_10-11-07_[general]_factura-costos-dashboard-financiero-filtros-admin.md`
- Home dashboard: `src/app/(dashboard)/page.tsx`
- Dashboard service/repo: `src/features/dashboard/dashboard.service.ts`, `src/features/dashboard/dashboard.repo.ts`
- Filtros patrón: `src/app/(dashboard)/pagos/page.tsx`, `src/app/(dashboard)/pagos/payments-table.tsx`, `src/components/shared/SearchInput.tsx`
- Autorización patrón: `proxy.ts`, `src/lib/dal.ts`, `src/app/(dashboard)/usuarios/page.tsx`, `src/lib/actions/auth.ts`
- Vista operativa factura/costos: `src/app/(dashboard)/pedidos/[id]/page.tsx`, `src/app/(dashboard)/pedidos/[id]/order-items-table.tsx`
