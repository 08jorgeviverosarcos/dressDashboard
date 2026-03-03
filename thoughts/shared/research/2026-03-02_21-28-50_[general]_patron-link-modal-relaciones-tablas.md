---
date: "2026-03-03T02:28:50Z"
researcher: Claude
git_commit: ca21d88
branch: main
repository: dressDashboard
topic: "Patrón de links en tablas para ver entidades relacionadas en modal"
tags: [research, codebase, tables, modals, navigation, patterns, related-entities]
status: complete
last_updated: "2026-03-03"
last_updated_by: Claude
---

# Research: Patrón de links en tablas para ver entidades relacionadas en modal

**Date**: 2026-03-03T02:28:50Z
**Researcher**: Claude
**Git Commit**: ca21d88
**Branch**: main
**Repository**: dressDashboard

## Research Question

¿Cómo se muestran actualmente las relaciones en las tablas (ej: nombre de producto en inventario)? ¿Existe un patrón de links clickeables que abran modales para ver el detalle de la entidad relacionada? Documentar el estado actual y definir el patrón para futuros módulos.

## Summary

**No existe actualmente un patrón de "click en columna relacionada → modal de detalle".** Las tablas muestran datos de relaciones como texto plano, y la navegación se hace de dos formas: (1) click en toda la fila → navegar a la página de detalle de la fila, o (2) en solo 2 tablas, un `<Link>` en la celda navega a la página completa de la entidad relacionada. No hay ningún dialog/modal de "vista previa" o "detalle rápido" de entidad en todo el codebase.

---

## Detailed Findings

### 1. Estado actual: Cómo se muestran relaciones en las tablas

Todas las tablas usan el componente `DataTable` (`src/components/shared/DataTable.tsx`) con columnas definidas inline en cada `*-table.tsx`. Las relaciones se muestran como **texto plano** en la celda:

| Tabla | Columna | Dato relacionado | ¿Clickeable? |
|-------|---------|------------------|---------------|
| `inventory-table.tsx` | Codigo | `row.product.code` | ❌ texto plano |
| `inventory-table.tsx` | Producto | `row.product.name` | ❌ texto plano |
| `orders-table.tsx` | Cliente | `row.client.name` | ❌ texto plano |
| `products-table.tsx` | Categoria | `row.category?.name` | ❌ texto plano |
| `order-items-table.tsx` | Nombre | `row.product.code` | ❌ texto plano |
| `payments-table.tsx` | Pedido | `row.order.orderNumber` | ✅ `<Link>` a `/pedidos/{id}` |
| `payments-table.tsx` | Cliente | `row.order.client.name` | ❌ texto plano |
| `gastos-table.tsx` | Pedido/Item | `row.orderItem.order.orderNumber` | ✅ `<Link>` a `/pedidos/{id}` |

**Solo 2 de 8 tablas** tienen links clickeables en celdas de relación, y ambos navegan a la **página completa** del pedido (no a un modal).

### 2. Patrones de navegación existentes

#### Patrón A: Click en fila completa → página de detalle (PRINCIPAL)

Usado en **todas las tablas** excepto `users-table.tsx`. El `DataTable` acepta `onRowClick`:

```tsx
// DataTable.tsx:19-24
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

// Ejemplo: inventory-table.tsx:150
onRowClick={(row) => router.push(`/inventario/${row.id}`)}
```

#### Patrón B: Link en celda con stopPropagation (SOLO 2 tablas)

Cuando una celda tiene un link a una entidad **diferente** a la fila:

```tsx
// payments-table.tsx:82-89
{
  key: "order",
  header: "Pedido",
  cell: (row) => (
    <Link
      href={`/pedidos/${row.order.id}`}
      className="text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      #{row.order.orderNumber}
    </Link>
  ),
},
```

**Convenciones del Patrón B:**
- Estilo: `className="text-primary hover:underline"`
- `onClick={(e) => e.stopPropagation()}` para evitar que se dispare el `onRowClick` de la fila
- Usa `next/link` `Link` component
- Relaciones nulas muestran `"—"`

### 3. Modales/Dialogs existentes — NO hay "detail view" modals

Los dialogs existentes en el codebase son:

| Componente | Tipo | Propósito |
|-----------|------|-----------|
| `ConfirmDialog.tsx` | Confirmación | Delete confirmations |
| `PaymentDialog.tsx` | Formulario | Crear/editar pagos |
| `EntitySelectorModal.tsx` | Selector | Seleccionar entidad de una lista |
| `OrderItemSelectorModal.tsx` | Selector multi-nivel | Seleccionar orden → item |
| `ProductQuickForm.tsx` | Formulario | Crear producto rápido |
| `CategoryQuickForm.tsx` | Formulario | Crear categoría rápida |
| `ClientQuickForm.tsx` | Formulario | Crear cliente rápido |

**Ninguno** muestra información de detalle read-only de una entidad. Todos son formularios, selectores, o confirmaciones.

### 4. Páginas de detalle existentes

Actualmente los detalles se ven en **páginas completas** (server components):

- `productos/[id]/page.tsx` — Detalle de producto (Cards con key-value rows)
- `clientes/[id]/page.tsx` — Detalle de cliente (Cards + tabla de pedidos)
- `pedidos/[id]/page.tsx` — Detalle de pedido (Cards + items + pagos)
- `categorias/[id]/page.tsx` — Detalle de categoría (Cards + productos)
- `inventario/[id]/page.tsx` — Detalle de inventario
- `gastos/[id]/page.tsx` — Detalle de gasto

**Patrón de detalle en páginas:**
```tsx
// productos/[id]/page.tsx
<Card>
  <CardHeader><CardTitle>Informacion del producto</CardTitle></CardHeader>
  <CardContent className="space-y-3 text-sm">
    <div className="flex justify-between">
      <span className="text-muted-foreground">Tipo</span>
      <Badge variant="secondary">{PRODUCT_TYPE_LABELS[product.type]}</Badge>
    </div>
    {/* más rows key-value */}
  </CardContent>
</Card>
```

### 5. Contrato de interface para dialogs

Todos los dialogs siguen este contrato consistente:

```tsx
interface StandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // datos de entidad pasados via props (NUNCA fetch interno)
}
```

### 6. Componente DataTable — Interface Column

```tsx
// src/components/shared/DataTable.tsx:12-17
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}
```

No usa TanStack Table. Es una implementación custom simple.

---

## Patrón propuesto para documentar: Link en celda → Modal de detalle

Basado en las convenciones existentes, el patrón para "click en columna relacionada → modal de detalle" combinaría:

### Componentes necesarios (no existen aún):

1. **`EntityDetailModal<T>`** — Componente genérico reutilizable para mostrar detalles de una entidad en un modal
2. **Cell renderer con onClick** — Render de celda que abre el modal en vez de navegar

### Convenciones que debe seguir (basado en patrones existentes):

1. **Estilo del link en celda**: `className="text-primary hover:underline cursor-pointer"`
2. **Stop propagation**: `onClick={(e) => { e.stopPropagation(); openModal(row.relatedEntity); }}`
3. **Datos via props**: El modal recibe datos via props, no hace fetch interno
4. **Contrato de dialog**: `open: boolean` + `onOpenChange: (open: boolean) => void`
5. **Layout de detalle**: Reutilizar el patrón de key-value rows: `flex justify-between` dentro de `space-y-3 text-sm`
6. **Footer**: Usar `DialogFooter` con botón "Cerrar"

---

## Code References

- `src/components/shared/DataTable.tsx:12-17` — Interface Column<T>
- `src/components/shared/DataTable.tsx:19-24` — Interface DataTableProps<T> (onRowClick)
- `src/components/shared/DataTable.tsx:56-59` — Row click handler
- `src/app/(dashboard)/pagos/payments-table.tsx:82-89` — Link en celda con stopPropagation (referencia principal)
- `src/app/(dashboard)/gastos/gastos-table.tsx:80-92` — Link en celda con stopPropagation (segunda referencia)
- `src/components/shared/ConfirmDialog.tsx` — Patrón de dialog reutilizable
- `src/components/shared/EntitySelectorModal.tsx` — Modal genérico con DataTable
- `src/components/orders/PaymentDialog.tsx:30-184` — Dialog con bloque informativo (summary block)
- `src/app/(dashboard)/productos/[id]/page.tsx:20-142` — Página de detalle (patrón key-value)
- `src/app/(dashboard)/clientes/[id]/page.tsx:17-120` — Página de detalle con tabla de relaciones

## Architecture Insights

### Hallazgos clave:

1. **No hay patrón de "preview modal"** — Todo detalle es navegación a página completa
2. **Solo 2/8 tablas** tienen links clickeables en celdas de relación (payments y gastos)
3. **El resto muestra relaciones como texto plano** — Incluyendo inventario (product.name), orders (client.name), products (category.name)
4. **Todos los dialogs reciben datos via props** — Ninguno hace fetch interno
5. **El DataTable es custom** — No TanStack Table, columnas definidas inline con closure sobre router/state
6. **Patrón de stopPropagation** está establecido en 2 tablas y en botones de acción

### Tablas donde sería aplicable el nuevo patrón:

| Tabla | Columna | Entidad relacionada | Prioridad |
|-------|---------|-------------------|-----------|
| `inventory-table.tsx` | Producto | Product | Alta |
| `orders-table.tsx` | Cliente | Client | Alta |
| `products-table.tsx` | Categoria | Category | Media |
| `order-items-table.tsx` | Nombre | Product | Media |
| `payments-table.tsx` | Cliente | Client | Media (ya tiene link a pedido) |
| `gastos-table.tsx` | (ya tiene link) | Order | Ya implementado como navegación |

## Open Questions

1. ¿El modal de detalle debe cargar datos frescos del servidor (server action) o usar los datos ya disponibles en la fila de la tabla?
2. ¿Se debe crear un componente genérico `EntityDetailModal` o componentes específicos por entidad (`ProductDetailModal`, `ClientDetailModal`)?
3. ¿El modal debe incluir un botón "Ver completo" que navegue a la página de detalle completa?
4. ¿Qué campos se muestran en el modal vs la página completa? (subset reducido vs misma info)
