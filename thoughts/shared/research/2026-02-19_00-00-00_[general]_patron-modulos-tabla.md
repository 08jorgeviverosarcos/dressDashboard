---
date: 2026-02-19T00:00:00-06:00
researcher: Claude Sonnet 4.6
git_commit: b96bfce05041ac46fc86f3d687e6cdc90e0d9226
branch: main
repository: dressDashboard
topic: "Patrón de módulos con tabla, search bar, botón eliminar y navegación a detalle"
tags: [research, codebase, DataTable, SearchInput, ConfirmDialog, tabla, patron, modulos]
status: complete
last_updated: 2026-02-19
last_updated_by: Claude Sonnet 4.6
---

# Research: Patrón de módulos con tabla, search bar, botón eliminar y navegación a detalle

**Date**: 2026-02-19T00:00:00-06:00
**Researcher**: Claude Sonnet 4.6
**Git Commit**: b96bfce05041ac46fc86f3d687e6cdc90e0d9226
**Branch**: main
**Repository**: dressDashboard

---

## Research Question

Analizar los módulos/tablas principales como patrón y con código reutilizable. Los módulos deben tener:
- La tabla con la search bar
- En la última columna los botones de eliminar
- Cada item sea clickeable para que lleve a la vista de detalle
- Esto debe definirse como patrón para cualquier módulo

---

## Summary

El proyecto tiene **7 módulos** con tablas: pedidos, gastos, productos, inventario, clientes, categorias y pagos. Existe ya una infraestructura reutilizable sólida (`DataTable`, `SearchInput`, `ConfirmDialog`, `PageHeader`) pero los módulos la usan de forma **inconsistente**:

- Solo **3 módulos** tienen filas clickeables que navegan a detalle: `pedidos`, `productos`, `clientes`
- Solo **2 módulos** tienen botones de acción en columna final de la tabla: `categorias` (edit + delete), `inventario` (delete solo)
- Los demás módulos (`gastos`, `pagos`) no tienen navegación de fila ni botones de acción en la tabla
- La `SearchInput` está ubicada en lugares distintos: en algunos módulos dentro del componente tabla, en otros en la `page.tsx`

El patrón completo (tabla + searchbar + delete en última columna + fila clickeable a detalle) **no existe de forma unificada** en ningún módulo hoy. El módulo `categorias` es el más cercano al patrón deseado (tiene delete en la tabla), pero no tiene `onRowClick` a detalle porque usa edición inline.

---

## Detailed Findings

### Componentes Compartidos Existentes

#### `DataTable` — `src/components/shared/DataTable.tsx`

Componente genérico tipado que acepta:
- `columns: Column<T>[]` — definición de columnas con `key`, `header`, función `cell` y `className` opcional
- `data: T[]` — arreglo de datos
- `onRowClick?: (row: T) => void` — callback opcional para click en fila (agrega `cursor-pointer`)
- `emptyMessage: string` — texto cuando no hay datos

Cuando `onRowClick` está definido, el `DataTable` renderiza las filas con `cursor-pointer` automáticamente.

#### `SearchInput` — `src/components/shared/SearchInput.tsx`

Componente de búsqueda de texto. Actualiza el parámetro `?search=` en la URL.

#### `ConfirmDialog` — `src/components/shared/ConfirmDialog.tsx`

Diálogo de confirmación reutilizable para eliminaciones. Props:
- `open`, `onOpenChange`, `title`, `description`
- `confirmLabel` (default: "Confirmar"), `cancelLabel` (default: "Cancelar")
- `variant: "default" | "destructive"`
- `onConfirm`, `loading`

Cuando `loading` es `true`, deshabilita ambos botones y muestra "Procesando..." en el botón de confirmación.

#### `PageHeader` — `src/components/shared/PageHeader.tsx:13-47`

Cabecera de página. Acepta `title`, `description`, `backHref` (botón ArrowLeft), `actionLabel` + `actionHref` (botón Plus para crear nuevo).

---

### Estado Actual de Cada Módulo

#### `pedidos` — `src/app/pedidos/`
- **List page**: `page.tsx` — Server Component, llama `getOrders({search, status})`, serializa con `JSON.parse(JSON.stringify(...))`
- **Table**: `orders-table.tsx` — tiene `SearchInput` integrado, filtro de estado por `Badge`, `onRowClick → router.push(\`/pedidos/${row.id}\`)`
- **Columna de acciones**: NO existe en la tabla. Delete no disponible desde la lista.
- **Detail page**: `[id]/page.tsx` — completa con métricas financieras, pagos, items, gastos vinculados

#### `gastos` — `src/app/gastos/`
- **List page**: `page.tsx` — Server Component, llama `getExpenses({search, category, expenseType})`, `SearchInput` a nivel de page
- **Table**: `gastos-table.tsx` — **sin `onRowClick`**, sin columna de acciones
- **Detail page**: NO existe
- **Nota**: tiene link a pedido vinculado en columna "Pedido" (`/pedidos/${orderId}`)

#### `productos` — `src/app/productos/`
- **List page**: `page.tsx` — Server Component, llama `getProducts({search, type})`
- **Table**: `products-table.tsx` — tiene `SearchInput` integrado, filtro por tipo vía `Select`, `onRowClick → router.push(\`/productos/${row.id}\`)`
- **Columna de acciones**: NO existe en la tabla
- **Detail page**: `[id]/page.tsx` — información del producto, items de inventario, pedidos recientes

#### `inventario` — `src/app/inventario/`
- **List page**: `page.tsx` — Server Component, llama `getInventoryItems({search, status})` + `getProducts()` con `Promise.all`
- **Table**: `InventoryPageClient.tsx` (en `src/components/inventory/`) — tiene `SearchInput`, filtros de estado por `Badge`
- **Columna de acciones**: tiene botón delete con `Trash2` (`size="icon"`, `w-10`), abre `ConfirmDialog`
- **Sin `onRowClick`**: no navega a detalle. Tiene `Select` inline para cambiar estado

#### `clientes` — `src/app/clientes/`
- **List page**: `page.tsx` — Server Component, llama `getClients(search)`, `SearchInput` a nivel de page
- **Table**: `clients-table.tsx` — `onRowClick → router.push(\`/clientes/${row.id}\`)`
- **Columna de acciones**: NO existe en la tabla. Delete está en la página de detalle vía `DeleteClientButton`
- **Detail page**: `[id]/page.tsx` — info de contacto, historial de pedidos con links, `DeleteClientButton`

#### `categorias` — `src/app/categorias/`
- **List page**: `page.tsx` — Server Component, llama `getCategories()`, sin search
- **Table**: `categories-table.tsx` — tiene columna de acciones con botón Edit (`router.push`) y Delete (`ConfirmDialog`), `e.stopPropagation()` en ambos
- **Sin `onRowClick`**: no navega a detalle (usa edición inline/edit page)
- **Sin SearchInput**

#### `pagos` — `src/app/pagos/`
- **List page**: `page.tsx` — Server Component, llama `getPayments({paymentMethod, startDate, endDate})`
- **Table**: `payments-table.tsx` — filtros de método por `Badge`, date inputs. **Sin `onRowClick`**, sin columna de acciones
- **Detail page**: NO existe. Los pagos se crean desde `/pedidos/{id}` vía `PaymentDialog`

---

### Patrón de Columna de Acciones

El patrón que usa `categorias` (el más completo en tabla) para la columna de acciones:

```tsx
// src/app/categorias/categories-table.tsx:51-74
{
  key: "id",
  header: "",   // columna sin header
  cell: (row) => (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/categorias/${row.id}/editar`);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          setDeletingId(row.id);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  ),
}
```

Cuando el delete es la única acción (inventario):
```tsx
// src/components/inventory/InventoryPageClient.tsx:148-157
{
  key: "actions",
  header: "",
  cell: (row) => (
    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  ),
  className: "w-10",
}
```

**Regla crítica**: siempre llamar `e.stopPropagation()` en los botones de acción para que no disparen el `onRowClick` del `DataTable`.

---

### Patrón de Estado para Delete en Tabla

```tsx
// Patrón usado en categorias-table.tsx y InventoryPageClient.tsx
const [deletingId, setDeletingId] = useState<string | null>(null);
const [deleteLoading, setDeleteLoading] = useState(false);

async function handleDelete() {
  if (!deletingId) return;
  setDeleteLoading(true);
  const result = await deleteXxx(deletingId);
  setDeleteLoading(false);
  setDeletingId(null);
  if (result.success) {
    toast.success("Elemento eliminado");
  } else {
    toast.error(result.error);
  }
}

// En el JSX, fuera del DataTable:
<ConfirmDialog
  open={!!deletingId}
  onOpenChange={(open) => !open && setDeletingId(null)}
  title="Eliminar elemento"
  description="¿Estás seguro? Esta acción no se puede deshacer."
  confirmLabel="Eliminar"
  variant="destructive"
  onConfirm={handleDelete}
  loading={deleteLoading}
/>
```

---

### Patrón de onRowClick (Navegación a Detalle)

```tsx
// Patrón usado en orders-table.tsx, products-table.tsx, clients-table.tsx
const router = useRouter();

<DataTable
  columns={columns}
  data={data}
  onRowClick={(row) => router.push(`/${modulo}/${row.id}`)}
  emptyMessage="No hay elementos registrados"
/>
```

---

### Patrón de SearchInput en Table Component

```tsx
// Patrón de orders-table.tsx y products-table.tsx (SearchInput dentro del componente tabla)
return (
  <div className="space-y-4">
    <div className="flex gap-2">
      <SearchInput placeholder="Buscar..." />
      {/* filtros adicionales */}
    </div>
    <DataTable ... />
    <ConfirmDialog ... />
  </div>
);
```

Vs. el patrón de `gastos` y `clientes` (SearchInput en la page):

```tsx
// src/app/gastos/page.tsx:25-30
<SearchInput placeholder="Buscar gastos..." />
<GastosTable expenses={expenses} />
```

---

### Inconsistencias en la Ubicación de SearchInput

| Módulo | SearchInput en... |
|--------|-------------------|
| pedidos | Dentro de `orders-table.tsx` |
| productos | Dentro de `products-table.tsx` |
| inventario | Dentro de `InventoryPageClient.tsx` |
| gastos | En `page.tsx` (fuera de la tabla) |
| clientes | En `page.tsx` (fuera de la tabla) |
| categorias | Sin SearchInput |
| pagos | Sin SearchInput (tiene filtros de fecha y método) |

---

### Flujo del Delete: Capas Arquitectónicas

```
UI (tabla) -- setDeletingId(id) --> ConfirmDialog
ConfirmDialog -- onConfirm --> handleDelete()
handleDelete() -- await deleteXxx(id) --> Server Action (src/lib/actions/)
Server Action -- service.deleteXxx(id) + revalidatePath --> Feature Service
Feature Service -- guard opcional + repo.deleteById(id) --> Repository
Repository -- prisma.entity.delete({ where: { id } }) --> Database
```

Tipos de guards en el service:
- **Con guard de integridad**: verifica dependencias antes de eliminar (ej: `countActiveProducts` en categorias)
- **Con lookup previo**: busca el item para obtener datos relacionados (ej: `orderId` en payments)
- **Sin guard**: elimina directamente (ej: gastos)

---

## Code References

- `src/components/shared/DataTable.tsx` — Componente tabla genérico reutilizable
- `src/components/shared/SearchInput.tsx` — Componente de búsqueda por URL param
- `src/components/shared/ConfirmDialog.tsx:1-54` — Diálogo de confirmación reutilizable
- `src/components/shared/PageHeader.tsx:13-47` — Cabecera de página reutilizable
- `src/app/categorias/categories-table.tsx:22-101` — Ejemplo más completo de columna de acciones en tabla
- `src/components/inventory/InventoryPageClient.tsx:148-157` — Patrón de delete icon-only
- `src/app/pedidos/orders-table.tsx:93` — Patrón de `onRowClick` a detalle
- `src/app/clientes/clients-table.tsx:49` — Patrón de `onRowClick` a detalle
- `src/app/productos/products-table.tsx:112` — Patrón de `onRowClick` a detalle
- `src/app/clientes/[id]/delete-client-button.tsx:1-55` — Patrón de delete en página de detalle

---

## Architecture Insights

### Patrón Completo del Módulo (como existe hoy en los módulos más completos)

```
src/app/{modulo}/
├── page.tsx              # Server Component: fetch + render XxxTable
├── {modulo}-table.tsx    # Client Component: DataTable + SearchInput + acciones
├── nuevo/
│   └── page.tsx          # Server Component o Client Component: form de creación
└── [id]/
    ├── page.tsx          # Server Component: detalle del item
    ├── editar/
    │   └── page.tsx      # Server Component: form de edición
    └── delete-xxx-button.tsx  # (opcional) Client Component: botón delete en detalle
```

### Módulos con Detail Page

| Módulo | Ruta detalle | Navigación desde tabla |
|--------|-------------|------------------------|
| pedidos | `/pedidos/{id}` | `onRowClick` en `orders-table.tsx` |
| productos | `/productos/{id}` | `onRowClick` en `products-table.tsx` |
| clientes | `/clientes/{id}` | `onRowClick` en `clients-table.tsx` |
| gastos | — | Sin detalle |
| inventario | — | Sin detalle |
| categorias | — | Usa edición inline (`/categorias/{id}/editar`) |
| pagos | — | Sin detalle propio (link a pedido) |

### Módulos con Delete en Tabla

| Módulo | Delete en tabla | Mecanismo |
|--------|----------------|-----------|
| categorias | Sí | Botón Trash2 en columna de acciones → `ConfirmDialog` |
| inventario | Sí | Botón Trash2 `size="icon"` → `ConfirmDialog` |
| pedidos | No | — |
| productos | No | — |
| clientes | No | Delete en página de detalle |
| gastos | No | — |
| pagos | No | — |

---

## Historical Context (from thoughts/)

No se encontraron documentos previos en `thoughts/` relacionados con este patrón.

---

## Related Research

No hay documentos de investigación previos en `thoughts/shared/research/`.

---

## Open Questions

1. ¿Qué módulos de los que no tienen detalle (`gastos`, `pagos`) deberían tenerlo?
2. ¿El `SearchInput` debe estandarizarse dentro del componente tabla o en la `page.tsx`?
3. ¿Los módulos `gastos` y `pagos` deberían tener columna de acciones con delete?
4. ¿`InventoryPageClient.tsx` debería moverse a `src/app/inventario/inventory-table.tsx` para seguir el patrón del resto?
