---
date: 2026-02-24T22:00:00-06:00
researcher: Claude
git_commit: 4bad6157d9239f875d3fe1ad201bc78bbc2e0bb3
branch: main
repository: dressDashboard
topic: "Patrón UI/UX estándar para seleccionar entidades relacionadas — Entity Selector Modal Spec"
tags: [research, codebase, entity-selector, modal, ui-pattern, forms, relations]
status: complete
last_updated: 2026-02-24
last_updated_by: Claude
---

# Research: Patrón Entity Selector Modal — Estado Actual + Spec

**Date**: 2026-02-24T22:00:00-06:00
**Researcher**: Claude
**Git Commit**: `4bad615`
**Branch**: main
**Repository**: dressDashboard

## Research Question

Documentar el patrón UI/UX estándar para seleccionar entidades relacionadas (relaciones entre tablas) en toda la app, incluyendo: (1) el estado actual de los selectores, (2) la spec del nuevo patrón "Entity Selector Modal" reutilizable.

---

## Parte 1: Estado Actual — Cómo se seleccionan entidades hoy

### Inventario completo de selectores de entidad

Hoy la app tiene **7 instancias** donde un formulario permite seleccionar una entidad relacionada (FK). Todas usan el componente **shadcn `Select`** (dropdown).

| # | Archivo | Entidad | Almacenamiento | Data Loading |
|---|---------|---------|---------------|-------------|
| 1 | `src/components/orders/OrderForm.tsx:217-226` | **Client** | `useState` | Server prop via `getClients()` |
| 2 | `src/components/orders/OrderItemRow.tsx:135-147` | **Product** (filtrado por tipo) | Parent callback → `useState` array | Server prop via `getProducts()` |
| 3 | `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx:175-186` | **Product** (filtrado por tipo) | `useState` | Server prop via `getProducts()` |
| 4 | `src/app/productos/product-form.tsx:135-161` | **Category** | React Hook Form (`categoryId`) | Server prop via `getCategories()` |
| 5 | `src/components/expenses/ExpenseForm.tsx:227-241` | **Order** (helper, no se envía) | `useState` | Server prop via `getOrders()` |
| 6 | `src/components/expenses/ExpenseForm.tsx:244-264` | **OrderItem** (filtrado por Order) | React Hook Form (`orderItemId`) | Server prop nested en orders |
| 7 | `src/app/inventario/inventory-table.tsx:201-212` | **Product** | `useState` | Server prop via `getProducts()` |

### Patrones observados

1. **Todos los datos se cargan server-side** y se pasan como props. No hay fetching client-side.
2. **Todos usan shadcn `Select`** (dropdown nativo). No existe Combobox, ni búsqueda, ni modal selector.
3. **Dos patrones de almacenamiento**: `useState` directo (instancias 1, 2, 3, 5, 7) y React Hook Form `FormField` (instancias 4, 6).
4. **Un caso de cascading selectors**: Order → OrderItem en ExpenseForm (instancias 5+6).
5. **Auto-fill on select**: Al seleccionar Product (instancias 2, 3), se auto-rellenan name, description, unitPrice, costAmount.

### Ejemplo de código actual (Client selector)

```tsx
// OrderForm.tsx:217-226
<Select value={clientId} onValueChange={setClientId}>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar cliente..." />
  </SelectTrigger>
  <SelectContent>
    {clients.map((c) => (
      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## Parte 2: Building Blocks Existentes

### Componentes reutilizables disponibles

| Componente | Archivo | Relevancia |
|-----------|---------|-----------|
| `Dialog` + subcomponentes | `src/components/ui/dialog.tsx` | Shell del modal. `DialogContent` ya es responsive (`max-w-[calc(100%-2rem)]` mobile, `sm:max-w-lg` desktop). `DialogFooter` auto-stacks botones. |
| `DataTable<T>` | `src/components/shared/DataTable.tsx` | Tabla genérica con `Column<T>[]`, `onRowClick`, `emptyMessage`. Ideal para listado dentro del modal. |
| `SearchInput` | `src/components/shared/SearchInput.tsx` | ⚠️ Usa URL search params (router.replace). **No es apto directamente** para uso dentro de modal — necesitaría una versión con estado local. |
| `Command` + `CommandInput` | `src/components/ui/command.tsx` | Primitivo cmdk para búsqueda en lista. `CommandDialog` existe pero nunca se usa. |
| `ConfirmDialog` | `src/components/shared/ConfirmDialog.tsx` | Patrón de referencia para diálogos reutilizables (props: `open`, `onOpenChange`, `onConfirm`). |
| `ScrollArea` | `src/components/ui/scroll-area.tsx` | Útil para limitar altura del listado dentro del modal. |

### Patrones de diálogo existentes

- **ConfirmDialog**: 12 instancias. Patrón: `open`/`onOpenChange` props, un solo paso.
- **PaymentDialog**: Form dialog con RHF + 6 campos. Patrón: `open`/`onOpenChange`, `DialogFooter`.
- **Inventory Add Dialog**: Inline en `inventory-table.tsx:193-230`. useState por campo.
- **Rental Cost Dialog**: Inline en `rental-manager.tsx:245-278`. useState por campo.
- **Ningún diálogo abre otro diálogo** (no hay nesting actual).

---

## Parte 3: Spec del Nuevo Patrón — Entity Selector Modal

### Concepto

Reemplazar todos los dropdowns de relaciones por un componente reutilizable que, al hacer click, abre un modal con tabla, búsqueda y opción de crear nuevo.

### Componente: `EntitySelectorModal<T>`

**Ubicación**: `src/components/shared/EntitySelectorModal.tsx`

**Props interface**:

```typescript
interface EntitySelectorColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface EntitySelectorModalProps<T> {
  // Control
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Configuración de entidad
  title: string;                          // "Seleccionar Cliente"
  searchPlaceholder?: string;             // "Buscar por nombre..."
  emptyMessage?: string;                  // "No se encontraron clientes"

  // Datos
  items: T[];                             // Lista completa de entidades
  columns: EntitySelectorColumn<T>[];     // Columnas de la tabla
  searchFilter: (item: T, query: string) => boolean;  // Filtro client-side
  getItemId: (item: T) => string;         // Extrae ID del item

  // Selección
  selectedId?: string;                    // ID actualmente seleccionado
  onSelect: (item: T) => void;           // Callback al seleccionar

  // Crear nuevo (opcional)
  allowCreate?: boolean;                  // Muestra botón "Crear nuevo"
  createLabel?: string;                   // "Crear cliente"
  renderCreateForm?: (props: {            // Render del form de creación
    onCreated: (item: T) => void;         //   callback cuando se crea exitosamente
    onCancel: () => void;                 //   callback para cancelar
  }) => React.ReactNode;
}
```

### Estructura visual del modal

```
┌─────────────────────────────────────────────┐
│  DialogHeader                               │
│  ┌─────────────────────────────────────────┐│
│  │ "Seleccionar Cliente"                   ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌──────────────────────┐  ┌─────────────┐ │
│  │ 🔍 Buscar...         │  │ + Crear     │ │
│  └──────────────────────┘  └─────────────┘ │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Nombre       │ Teléfono  │ Email       ││
│  ├──────────────┼───────────┼─────────────┤│
│  │ María López  │ 555-1234  │ m@mail.com  ││ ← click selecciona
│  │ ✓ Ana Ruiz   │ 555-5678  │ a@mail.com  ││ ← fila seleccionada
│  │ Carlos Díaz  │ 555-9012  │ c@mail.com  ││
│  └─────────────────────────────────────────┘│
│                                             │
│  DialogFooter                               │
│  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Cancelar   │  │  Seleccionar         │ │
│  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Vista "Crear nuevo" (dentro del mismo modal)

Cuando `allowCreate=true` y el usuario hace click en "Crear nuevo":

```
┌─────────────────────────────────────────────┐
│  DialogHeader                               │
│  ┌─────────────────────────────────────────┐│
│  │ "Crear Cliente"       [← Volver]       ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │  Nombre: [_______________]              ││
│  │  Teléfono: [_______________]            ││
│  │  Email: [_______________]               ││
│  └─────────────────────────────────────────┘│
│                                             │
│  DialogFooter                               │
│  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Cancelar   │  │  Crear y Seleccionar │ │
│  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Flujo**: El formulario de creación llama a su server action → en `onCreated(newItem)`, el modal auto-selecciona el nuevo registro y cierra.

### Componente Trigger: `EntitySelectorTrigger`

El botón/input que se renderiza en el formulario padre (reemplaza al `Select`):

```typescript
interface EntitySelectorTriggerProps {
  label?: string;                        // Label del FormField
  placeholder?: string;                  // "Seleccionar cliente..."
  displayValue?: string;                 // Texto a mostrar cuando hay selección ("María López")
  onClick: () => void;                   // Abre el modal
  onClear?: () => void;                  // Limpia la selección (opcional)
  disabled?: boolean;
  error?: string;
}
```

**Visual**: Se ve como un `SelectTrigger` de shadcn (borde, placeholder, chevron), pero al hacer click abre el modal en lugar de un dropdown.

### Flujo completo de selección

```
1. Usuario ve el formulario con EntitySelectorTrigger
   → Muestra "María López" o "Seleccionar cliente..."

2. Click en el trigger → abre EntitySelectorModal (open=true)

3. Dentro del modal:
   a) Lista filtrable con búsqueda client-side
   b) Click en fila → marca como seleccionada (highlight)
   c) Click "Seleccionar" → onSelect(item) → cierra modal

4. Flujo alternativo — Crear nuevo:
   a) Click "Crear nuevo" → vista cambia a form de creación
   b) Llena form → submit → server action crea registro
   c) onCreated(newItem) → auto-selecciona → cierra modal

5. El formulario padre recibe el item completo
   → Actualiza displayValue + ID interno
   → Puede auto-fill otros campos (ej: Product → unitPrice)
```

### Integración con patrones existentes

**Con `useState`** (OrderForm, OrderItemRow, etc.):
```tsx
const [clientId, setClientId] = useState("");
const [clientName, setClientName] = useState("");
const [selectorOpen, setSelectorOpen] = useState(false);

<EntitySelectorTrigger
  placeholder="Seleccionar cliente..."
  displayValue={clientName}
  onClick={() => setSelectorOpen(true)}
/>
<EntitySelectorModal
  open={selectorOpen}
  onOpenChange={setSelectorOpen}
  title="Seleccionar Cliente"
  items={clients}
  columns={clientColumns}
  searchFilter={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
  getItemId={(c) => c.id}
  selectedId={clientId}
  onSelect={(c) => { setClientId(c.id); setClientName(c.name); }}
/>
```

**Con React Hook Form** (ProductForm, ExpenseForm):
```tsx
<FormField control={form.control} name="categoryId" render={({ field }) => (
  <FormItem>
    <FormLabel>Categoría</FormLabel>
    <EntitySelectorTrigger
      displayValue={categories.find(c => c.id === field.value)?.name}
      placeholder="Seleccionar categoría..."
      onClick={() => setCategorySelectorOpen(true)}
    />
    <EntitySelectorModal
      open={categorySelectorOpen}
      onOpenChange={setCategorySelectorOpen}
      title="Seleccionar Categoría"
      items={categories}
      columns={categoryColumns}
      searchFilter={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
      getItemId={(c) => c.id}
      selectedId={field.value}
      onSelect={(c) => field.onChange(c.id)}
      allowCreate
      createLabel="Crear categoría"
      renderCreateForm={({ onCreated, onCancel }) => (
        <CategoryQuickForm onCreated={onCreated} onCancel={onCancel} />
      )}
    />
    <FormMessage />
  </FormItem>
)} />
```

### Instancias donde se aplicaría

| Formulario | Relación | Prioridad | Notas |
|-----------|----------|-----------|-------|
| OrderForm | Order → Client | Alta | Principal use case. `allowCreate` con form rápido de cliente. |
| OrderItemRow | OrderItem → Product | Alta | Filtrado por tipo (SALE/RENTAL). Auto-fill name, price, cost. |
| OrderItemEditForm | OrderItem → Product | Alta | Mismo que anterior, en modo edición. |
| ProductForm | Product → Category | Media | `allowCreate` con form rápido de categoría. |
| ExpenseForm | Expense → Order | Media | No necesita "crear nuevo". Solo listado + búsqueda. |
| ExpenseForm | Expense → OrderItem | Media | Cascading: depende de Order seleccionado. |
| InventoryTable | InventoryItem → Product | Media | Dentro de dialog existente de "Agregar Item". |

### Consideraciones de responsividad

Según CLAUDE.md §17:

- `DialogContent` base ya es responsive (`max-w-[calc(100%-2rem)]` mobile, `sm:max-w-lg`).
- Para el Entity Selector usar **`sm:max-w-2xl`** (más ancho que default para tabla).
- Tabla dentro del modal: usa `overflow-x-auto` wrapper.
- Botones en `DialogFooter` (auto-stack en mobile).
- Search input: `text-base md:text-sm` para evitar zoom iOS.
- Columnas no esenciales: `hidden sm:table-cell` en mobile.
- Form de creación dentro del modal: `grid grid-cols-1 gap-4 sm:grid-cols-2`.

### Consideraciones de data loading

El patrón actual carga **todos los datos server-side** y los pasa como props. Esto sigue siendo válido para entidades con pocos registros (Clients, Categories, Products). Si en el futuro una entidad tiene muchos registros (cientos+), se podría:

1. Mantener server-side load para la lista inicial
2. Agregar búsqueda server-side como enhancement futuro (server action que filtra)

Pero para v1, **filtrado client-side es suficiente** dado el volumen actual.

---

## Code References

- `src/components/orders/OrderForm.tsx:217-226` — Client selector actual (shadcn Select)
- `src/components/orders/OrderItemRow.tsx:135-147` — Product selector actual con auto-fill
- `src/app/pedidos/[id]/items/[itemId]/editar/order-item-edit-form.tsx:175-186` — Product selector en edición
- `src/app/productos/product-form.tsx:135-161` — Category selector con RHF FormField
- `src/components/expenses/ExpenseForm.tsx:227-264` — Cascading Order → OrderItem selectors
- `src/app/inventario/inventory-table.tsx:201-212` — Product selector en dialog de inventario
- `src/components/shared/DataTable.tsx` — Tabla genérica (building block)
- `src/components/shared/SearchInput.tsx` — SearchInput basado en URL params (necesita versión local)
- `src/components/shared/ConfirmDialog.tsx` — Patrón de referencia para diálogos reutilizables
- `src/components/ui/dialog.tsx` — Primitivos del modal
- `src/components/ui/command.tsx` — Command/cmdk primitivos (CommandDialog sin usar)

## Architecture Insights

1. **No existe ningún patrón de selector en modal** — todo es dropdown shadcn Select.
2. **DataTable<T> es directamente reutilizable** dentro del modal (ya tiene `onRowClick`).
3. **SearchInput NO es reutilizable** directamente — depende de URL params vía Next.js router. Se necesita una versión con estado local (ej: `LocalSearchInput` o un prop `value`/`onChange`).
4. **CommandDialog existe pero no se usa** — podría ser alternativa, pero el spec pide tabla con columnas, no lista cmdk.
5. **Todos los datos se cargan SSR** — el modal recibiría `items` como prop, sin cambio arquitectónico.
6. **Dos patrones de form state coexisten** (useState vs RHF) — el componente debe soportar ambos vía callback genérico `onSelect(item: T)`.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-19_00-00-00_[general]_patron-modulos-tabla.md` — Patrón de módulos tabla con SearchInput + DataTable + ConfirmDialog
- `thoughts/shared/plans/2026-02-19_16-00-00_[general]_estandarizacion-patron-modulos-tabla.md` — Plan de estandarización de módulos tabla (establece DataTable + SearchInput como estándar)
- `thoughts/shared/plans/2026-02-23_16-07-17_[general]_order-items-editar-reorganizacion-uiux.md` — Reorganización UI/UX de OrderItems (contiene layout del formulario donde vive el selector de Product)
- `thoughts/shared/research/2026-02-24_17-36-58_general_responsive-design-audit.md` — Auditoría responsive (reglas para dialogs y forms)

No existen documentos previos sobre el concepto de "entity selector modal" o "relation picker".

## Open Questions

1. **¿SearchInput refactorizado o componente nuevo?** — SearchInput actual usa URL params. ¿Crear `LocalSearchInput` separado, o agregar prop `mode: "url" | "local"` al existente?
2. **¿Cascading selectors (Order → OrderItem en ExpenseForm)?** — ¿El segundo modal muestra solo items del Order seleccionado, o el primer modal también migra a este patrón?
3. **¿Tamaño del modal?** — Para entidades con pocas columnas (Category: solo nombre) quizás `sm:max-w-lg` basta. Para Product (code, name, type, price) se necesita `sm:max-w-2xl`. ¿Configurable por instancia?
4. **¿"Crear nuevo" abre sub-modal o cambia vista dentro del mismo modal?** — El spec propone cambiar vista (sin nesting). ¿Confirmar?
5. **¿Highlight + botón "Seleccionar" o click directo?** — ¿Un solo click en fila selecciona y cierra, o primero highlight y luego click en botón "Seleccionar"? El segundo es más seguro contra clicks accidentales.
