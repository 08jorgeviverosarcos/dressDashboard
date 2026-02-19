# Estandarización del Patrón de Módulos con Tabla

## Overview

Estandarizar los 7 módulos del dashboard (`pedidos`, `gastos`, `productos`, `inventario`, `clientes`, `categorias`, `pagos`) para que todos sigan el mismo patrón:

1. `SearchInput` dentro del componente tabla (no en `page.tsx`)
2. Botón de eliminar en la última columna de acciones
3. Cada fila clickeable que navega a su vista de detalle (`/modulo/{id}`)

---

## Current State Analysis

El proyecto tiene infraestructura reutilizable sólida (`DataTable`, `SearchInput`, `ConfirmDialog`, `PageHeader`) pero los módulos la usan de forma inconsistente.

### Estado por módulo (antes del plan)

| Módulo | SearchInput | onRowClick | Delete en tabla | Delete backend | Detail page |
|--------|-------------|------------|-----------------|----------------|-------------|
| Pedidos | ✅ en tabla | ✅ existe | ❌ falta | ❌ no existe | ✅ existe |
| Gastos | ❌ en page.tsx | ❌ falta | ❌ falta | ✅ existe (sin guard) | ❌ no existe |
| **Productos** | ✅ en tabla | ✅ existe | — sin delete | — sin delete | ✅ existe |
| Inventario | ✅ en tabla | ❌ falta | ✅ ya existe | ✅ existe (guard) | ❌ no existe |
| Clientes | ❌ en page.tsx | ✅ existe | ❌ falta | ✅ existe (guard) | ✅ existe |
| Categorias | ❌ no existe | ❌ falta | ✅ ya existe | ✅ existe (guard) | ❌ no existe |
| Pagos | ❌ no existe | ❌ falta | ❌ falta | ✅ existe (guard) | ❌ no existe |

> **Productos** ya cumple el patrón (SearchInput en tabla, onRowClick). No tiene delete por decisión explícita. **No requiere cambios.**

### Archivo de inventario fuera de lugar

El componente de tabla de inventario vive en `src/components/inventory/InventoryPageClient.tsx` en vez de `src/app/inventario/inventory-table.tsx` como el resto de módulos. Debe moverse.

---

## Desired End State

Todos los módulos siguen exactamente este patrón:

```
src/app/{modulo}/
├── page.tsx                    # Server Component: fetch + render XxxTable (sin SearchInput)
├── {modulo}-table.tsx          # Client Component: SearchInput + filtros + DataTable + ConfirmDialog
└── [id]/
    └── page.tsx                # Server Component: vista de detalle
```

El componente tabla siempre tiene:
```tsx
<div className="space-y-4">
  <div className="flex items-center gap-4">
    <div className="flex-1">
      <SearchInput placeholder="Buscar..." />
    </div>
    {/* acciones adicionales opcionales */}
  </div>
  {/* filtros opcionales */}
  <DataTable
    columns={columns}
    data={data}
    onRowClick={(row) => router.push(`/${modulo}/${row.id}`)}
    emptyMessage="No se encontraron..."
  />
  <ConfirmDialog ... />
</div>
```

### Verificación del estado final

- [ ] Todos los módulos muestran SearchInput dentro del componente tabla, no en page.tsx
- [ ] Todas las filas son clickeables y navegan al detalle
- [ ] Todos los módulos tienen botón Trash2 en columna final (excepto productos)
- [ ] `ConfirmDialog` aparece al clickear delete en todos los módulos relevantes
- [ ] Las 4 nuevas detail pages muestran información del item correctamente
- [ ] El componente inventario vive en `src/app/inventario/inventory-table.tsx`

---

## What We're NOT Doing

- ❌ No agregar delete para **productos** (decisión del usuario)
- ❌ No agregar detail page para **pedidos** y **clientes** (ya existen)
- ❌ No agregar detail page para **productos** (ya existe)
- ❌ No refactorizar el patrón de delete inline de inventario (Select por fila)
- ❌ No cambiar la lógica de negocio de ningún módulo
- ❌ No cambiar queries Prisma existentes
- ❌ No agregar edición inline a ningún módulo que no la tenga
- ❌ No migrar a API routes

---

## Implementation Approach

Tres fases secuenciales:

1. **Phase 1 (Backend)**: Crear lo que falta en el backend antes de tocar UI — delete cascade para pedidos, search para categorias y pagos, get-by-id actions para nuevas detail pages.
2. **Phase 2 (Detail pages)**: Crear las 4 nuevas pages de detalle usando las actions de Phase 1.
3. **Phase 3 (Tables)**: Estandarizar cada componente tabla, módulo por módulo.

---

## Phase 1: Backend Prerequisites

### Overview

Crear los backends faltantes antes de tocar UI. Ningún cambio visual. Completamente testeable vía TypeScript y verificación manual de la DB.

### 1a. Mover InventoryPageClient

**Acción**: Mover `src/components/inventory/InventoryPageClient.tsx` → `src/app/inventario/inventory-table.tsx`

**Cambios**:

**Archivo nuevo**: `src/app/inventario/inventory-table.tsx`
- Contenido: copia exacta de `InventoryPageClient.tsx`
- Cambiar el nombre del export de `InventoryPageClient` → `InventoryTable`

**Archivo modificado**: `src/app/inventario/page.tsx`
- Cambiar import: `from "@/components/inventory/InventoryPageClient"` → `from "./inventory-table"`
- Cambiar uso: `<InventoryPageClient ...>` → `<InventoryTable ...>`

**Archivo eliminado**: `src/components/inventory/InventoryPageClient.tsx`

---

### 1b. Delete backend para Pedidos (cascade)

El usuario decidió que eliminar un pedido elimina en cascada todos sus datos relacionados.

**Análisis del schema para cascade**:
- `OrderItem` tiene `onDelete: Cascade` desde `Order` → se elimina automáticamente
- `Expense.orderItemId` es opcional → SetNull automático al eliminar OrderItem
- `AuditLog.orderId` es opcional → SetNull automático al eliminar Order
- `Payment.orderId` es requerido → debe eliminarse manualmente primero
- `Rental.orderId` es requerido → debe eliminarse manualmente primero
- `RentalCost.rentalId` tiene `onDelete: Cascade` desde `Rental` → se elimina automáticamente al eliminar Rental

**Orden de eliminación en la transacción**:
1. Eliminar `Payment` donde `orderId = id`
2. Eliminar `Rental` donde `orderId = id` (y sus `RentalCost` en cascada)
3. Eliminar `Order` (y sus `OrderItem` en cascada; `Expense.orderItemId` y `AuditLog.orderId` quedan en null)

#### 1b.1 Repo
**Archivo**: `src/features/orders/orders.repo.ts`
**Cambio**: Agregar función `deleteWithCascade` al final del archivo

```typescript
export function deleteWithCascade(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { orderId: id } });
    const rental = await tx.rental.findUnique({ where: { orderId: id } });
    if (rental) {
      await tx.rental.delete({ where: { id: rental.id } });
    }
    await tx.order.delete({ where: { id } });
  });
}
```

#### 1b.2 Service
**Archivo**: `src/features/orders/orders.service.ts`
**Cambio**: Agregar función `deleteOrder` al final del archivo

```typescript
export async function deleteOrder(id: string): Promise<ActionResult> {
  await repo.deleteWithCascade(id);
  return { success: true, data: undefined };
}
```

#### 1b.3 Action
**Archivo**: `src/lib/actions/orders.ts`
**Cambio**: Agregar acción `deleteOrder` al final del archivo

```typescript
export async function deleteOrder(id: string): Promise<ActionResult> {
  const result = await service.deleteOrder(id);
  if (result.success) revalidatePath("/pedidos");
  return result;
}
```

---

### 1c. Search support para Categorias

Actualmente `getCategories()` no filtra por búsqueda. El `SearchInput` escribe `?search=` en la URL; la page necesita leerlo y pasarlo al fetch.

#### 1c.1 Repo
**Archivo**: `src/features/categories/categories.repo.ts`
**Cambio**: Agregar parámetro `search` opcional a `findAll`

```typescript
// Cambiar la firma de:
export function findAll() {
// a:
export function findAll(filters?: { search?: string }) {
  const where = filters?.search
    ? { OR: [
        { name: { contains: filters.search, mode: "insensitive" as const } },
        { code: { contains: filters.search, mode: "insensitive" as const } },
      ]}
    : {};
  return prisma.category.findMany({ where, orderBy: { name: "asc" } });
}
```

> Nota: Preservar el `orderBy` existente (verificar cuál usa el repo actual antes de aplicar).

#### 1c.2 Service
**Archivo**: `src/features/categories/categories.service.ts`
**Cambio**: Actualizar `getCategories` para aceptar y pasar `search`

```typescript
// Cambiar de:
export function getCategories() {
  return repo.findAll();
}
// a:
export function getCategories(filters?: { search?: string }) {
  return repo.findAll(filters);
}
```

#### 1c.3 Action
**Archivo**: `src/lib/actions/categories.ts`
**Cambio**: Actualizar `getCategories` para aceptar y pasar `search`

```typescript
// Cambiar de:
export async function getCategories() {
  return service.getCategories();
}
// a:
export async function getCategories(filters?: { search?: string }) {
  return service.getCategories(filters);
}
```

#### 1c.4 Agregar getCategory(id) para el detail page

**Verificar si `getCategory(id)` existe** en `src/lib/actions/categories.ts`. Si no existe, crearlo:

En `src/features/categories/categories.repo.ts`, agregar `findById` si no existe:
```typescript
export function findById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      products: {
        select: { id: true, code: true, name: true, type: true },
        orderBy: { name: "asc" },
      },
    },
  });
}
```

En `src/features/categories/categories.service.ts`, agregar:
```typescript
export function getCategory(id: string) {
  return repo.findById(id);
}
```

En `src/lib/actions/categories.ts`, agregar:
```typescript
export async function getCategory(id: string) {
  return service.getCategory(id);
}
```

---

### 1d. Search support para Pagos

Actualmente `getPayments()` filtra por método y fechas, pero no por texto libre.

#### 1d.1 Repo
**Archivo**: `src/features/payments/payments.repo.ts`
**Cambio**: Agregar `search` opcional al `findAll`. Buscar en: número de pedido y nombre de cliente.

Agregar al objeto `where` en `findAll`:
```typescript
if (filters?.search) {
  const asNumber = parseInt(filters.search);
  where.OR = [
    { order: { client: { name: { contains: filters.search, mode: "insensitive" } } } },
    ...(!isNaN(asNumber) ? [{ order: { orderNumber: { equals: asNumber } } }] : []),
  ];
}
```

#### 1d.2 Service
**Archivo**: `src/features/payments/payments.service.ts`
**Cambio**: Agregar `search?: string` al tipo de filtros de `getPayments`

#### 1d.3 Action
**Archivo**: `src/lib/actions/payments.ts`
**Cambio**: Agregar `search?: string` a los parámetros de `getPayments`

#### 1d.4 Verificar getPayment(id)

**Verificar si `getPayment(id)` existe** en `src/lib/actions/payments.ts`. Si existe, usarlo para el detail page. Si no, crearlo siguiendo el mismo patrón que los otros módulos.

---

### 1e. getInventoryItem(id) para detail page

**Verificar si `getInventoryItem(id)` existe** en `src/lib/actions/inventory.ts`.

Si no existe, en `src/features/inventory/inventory.repo.ts` agregar:
```typescript
export function findById(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      product: true,
    },
  });
}
```

En `src/features/inventory/inventory.service.ts` agregar:
```typescript
export function getInventoryItem(id: string) {
  return repo.findById(id);
}
```

En `src/lib/actions/inventory.ts` agregar:
```typescript
export async function getInventoryItem(id: string) {
  return service.getInventoryItem(id);
}
```

---

### Success Criteria Phase 1

#### Automated Verification:
- [x] TypeScript compila sin errores: `npx tsc --noEmit` (solo errores pre-existentes, no en archivos modificados)
- [x] `src/app/inventario/page.tsx` importa desde `"./inventory-table"` y no desde `"@/components/inventory/InventoryPageClient"`
- [x] El archivo `src/components/inventory/InventoryPageClient.tsx` ya no existe
- [x] `deleteWithCascade` existe en `orders.repo.ts`
- [x] `deleteOrder` existe en `orders.service.ts` y en `src/lib/actions/orders.ts`
- [x] `getCategories` acepta `filters?: { search?: string }` en action, service y repo
- [x] `getCategory(id)` existe en `src/lib/actions/categories.ts`
- [x] `getPayments` acepta `search?: string` en action, service y repo
- [x] `getInventoryItem(id)` existe en `src/lib/actions/inventory.ts`

#### Manual Verification:
- [ ] La página `/inventario` carga correctamente (sin errores de import)
- [ ] El resto de funcionalidades de inventario siguen funcionando (add, delete, change status)

**Pausa aquí para confirmar Phase 1 antes de continuar.**

---

## Phase 2: Crear Detail Pages

### Overview

Crear las 4 páginas de detalle nuevas. Son Server Components que usan las actions creadas en Phase 1. Siguen el patrón de `src/app/clientes/[id]/page.tsx`.

---

### 2a. Gastos — Detail Page

**Archivo nuevo**: `src/app/gastos/[id]/page.tsx`

El gasto ya tiene un edit page (`/gastos/[id]/editar/page.tsx`). La detail page muestra la información del gasto y permite ir a editar o eliminar.

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { getExpense } from "@/lib/actions/expenses";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, EXPENSE_TYPE_LABELS } from "@/lib/constants/categories";
import { Pencil } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GastoDetailPage({ params }: Props) {
  const { id } = await params;
  const expense = await getExpense(id);

  if (!expense) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={expense.description}
        backHref="/gastos"
      />

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href={`/gastos/${id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del gasto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha</span>
            <span>{formatDate(expense.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Categoría</span>
            <span>{expense.category}{expense.subcategory ? ` / ${expense.subcategory}` : ""}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto</span>
            <span className="font-medium">{formatCurrency(expense.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <Badge variant="secondary">{EXPENSE_TYPE_LABELS[expense.expenseType] ?? expense.expenseType}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Método de pago</span>
            <Badge variant="outline">{PAYMENT_METHOD_LABELS[expense.paymentMethod] ?? expense.paymentMethod}</Badge>
          </div>
          {expense.responsible && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Encargado</span>
              <span>{expense.responsible}</span>
            </div>
          )}
          {expense.orderItem && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedido vinculado</span>
              <Link
                href={`/pedidos/${expense.orderItem.order.id}`}
                className="text-primary hover:underline"
              >
                #{expense.orderItem.order.orderNumber} — {expense.orderItem.product.name}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 2b. Inventario — Detail Page

**Archivo nuevo**: `src/app/inventario/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import { getInventoryItem } from "@/lib/actions/inventory";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { INVENTORY_STATUS_LABELS } from "@/lib/constants/categories";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InventarioDetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getInventoryItem(id);

  if (!item) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${item.product.code} — ${item.product.name}`}
        backHref="/inventario"
      />

      <Card>
        <CardHeader>
          <CardTitle>Información del item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Producto</span>
            <span className="font-medium">{item.product.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Código</span>
            <span>{item.product.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cantidad</span>
            <span>{item.quantityOnHand}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant="secondary">
              {INVENTORY_STATUS_LABELS[item.status as keyof typeof INVENTORY_STATUS_LABELS] ?? item.status}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Número de usos</span>
            <span>{item.usageCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha de adquisición</span>
            <span>{formatDate(item.acquiredAt)}</span>
          </div>
          {item.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notas</span>
              <span>{item.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Nota**: Verificar el tipo exacto de `item` que retorna `getInventoryItem`. Ajustar los campos según lo que realmente retorna el repo (`acquiredAt`, `usageCount`, etc.).

---

### 2c. Categorias — Detail Page

**Archivo nuevo**: `src/app/categorias/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategory } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoriaDetailPage({ params }: Props) {
  const { id } = await params;
  const category = await getCategory(id);

  if (!category) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        backHref="/categorias"
      />

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href={`/categorias/${id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Código</span>
            <span className="font-medium">{category.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre</span>
            <span>{category.name}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos ({category.products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {category.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin productos en esta categoría</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Código</th>
                    <th className="p-3 text-left font-medium">Nombre</th>
                    <th className="p-3 text-left font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {category.products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <Link href={`/productos/${product.id}`} className="text-primary hover:underline font-medium">
                          {product.code}
                        </Link>
                      </td>
                      <td className="p-3">{product.name}</td>
                      <td className="p-3">{product.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Nota**: Verificar que `category.products` incluye el campo `type`. Ajustar según el tipo real que retorna `getCategory`.

---

### 2d. Pagos — Detail Page

**Archivo nuevo**: `src/app/pagos/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPayment } from "@/lib/actions/payments";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/constants/categories";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PagoDetailPage({ params }: Props) {
  const { id } = await params;
  const payment = await getPayment(id);

  if (!payment) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pago — ${formatCurrency(payment.amount)}`}
        backHref="/pagos"
      />

      <Card>
        <CardHeader>
          <CardTitle>Información del pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha</span>
            <span>{formatDate(payment.paymentDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto</span>
            <span className="font-medium">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <Badge variant="secondary">{PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Método</span>
            <Badge variant="outline">{PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</Badge>
          </div>
          {payment.reference && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Referencia</span>
              <span>{payment.reference}</span>
            </div>
          )}
          {payment.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notas</span>
              <span>{payment.notes}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pedido</span>
            <Link href={`/pedidos/${payment.order.id}`} className="text-primary hover:underline">
              #{payment.order.orderNumber} — {payment.order.client.name}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Nota**: Verificar que `getPayment(id)` retorna el payment con `include: { order: { include: { client: true } } }`. Si el repo actual solo retorna el payment simple, agregar el include correspondiente.

---

### Success Criteria Phase 2

#### Automated Verification:
- [x] TypeScript compila sin errores: `npx tsc --noEmit`
- [x] Los 4 archivos `[id]/page.tsx` nuevos existen

#### Manual Verification:
- [ ] `/gastos/{id}` carga y muestra la información correcta del gasto
- [ ] `/inventario/{id}` carga y muestra la información del item
- [ ] `/categorias/{id}` carga y muestra la categoría con su lista de productos
- [ ] `/pagos/{id}` carga y muestra la información del pago con link al pedido
- [ ] Los 4 nuevos detail pages muestran 404 para IDs inválidos

**Pausa aquí para confirmar Phase 2 antes de continuar.**

---

## Phase 3: Estandarizar Tablas

### Overview

Actualizar cada componente tabla para que todos cumplan el patrón. Se trabaja módulo por módulo para facilitar verificación incremental.

**Patrón de delete en tabla (referencia)**:
```tsx
// Estado
const [deletingId, setDeletingId] = useState<string | null>(null);
const [deleteLoading, setDeleteLoading] = useState(false);

// Handler
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

// Columna de acciones (última columna)
{
  key: "actions",
  header: "",
  cell: (row) => (
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
  ),
}

// Fuera del DataTable
<ConfirmDialog
  open={!!deletingId}
  onOpenChange={(open) => !open && setDeletingId(null)}
  title="Eliminar {elemento}"
  description="¿Estás seguro? Esta acción no se puede deshacer."
  confirmLabel="Eliminar"
  variant="destructive"
  onConfirm={handleDelete}
  loading={deleteLoading}
/>
```

---

### 3a. Pedidos

**Archivo**: `src/app/pedidos/orders-table.tsx`

**Cambios**:
1. Agregar `useState` para `deletingId` y `deleteLoading`
2. Agregar import de `deleteOrder` desde `@/lib/actions/orders`
3. Agregar imports de `useState`, `toast`, `ConfirmDialog`, `Trash2`, `Button`
4. Agregar columna `"actions"` al final del array `columns`
5. Agregar `handleDelete` function
6. Cambiar el return para envolver en Fragment `<>` y agregar `<ConfirmDialog>` después del `</div>` principal

**Nota**: Actualmente este componente NO tiene `useState` y las columnas se definen DENTRO del componente. Mantener ese estilo — solo agregar los nuevos `useState` y la columna de acciones.

**Toast message**: `"Pedido eliminado"` y el error del result.

---

### 3b. Gastos

**Archivo tabla**: `src/app/gastos/gastos-table.tsx`

**Cambios**:
1. El componente actualmente es completamente stateless. Necesita volverse un Client Component con hooks.
2. Agregar `useRouter` para `onRowClick`
3. Agregar `useState` para `deletingId` y `deleteLoading`
4. Agregar `SearchInput` al inicio del return (con `usePathname`, `useSearchParams` si los necesita — pero `SearchInput` es autónomo, solo necesita existir en el componente cliente)
5. Agregar import de `deleteExpense` desde `@/lib/actions/expenses`
6. Agregar imports de `useState`, `useRouter`, `toast`, `SearchInput`, `ConfirmDialog`, `Trash2`, `Button`
7. Agregar `onRowClick={(row) => router.push(`/gastos/${row.id}`)}` al `DataTable`
8. Agregar columna `"actions"` al final de columns
9. Agregar `handleDelete` function
10. Cambiar el return para incluir `SearchInput` + `DataTable` + `ConfirmDialog`

**Archivo page**: `src/app/gastos/page.tsx`
- Eliminar `import { SearchInput }`
- Eliminar `<SearchInput placeholder="..." />`

**Toast message**: `"Gasto eliminado"` y el error del result.

---

### 3c. Clientes

**Archivo tabla**: `src/app/clientes/clients-table.tsx`

**Cambios**:
1. Actualmente las columnas se definen a nivel de módulo (fuera del componente). Con delete necesitaremos `useState` dentro del componente, y la columna de acciones necesita acceso a `setDeletingId`. Mover la definición de `columns` DENTRO del componente (como hacen los demás módulos).
2. Agregar `useState` para `deletingId` y `deleteLoading`
3. Agregar import de `deleteClient` desde `@/lib/actions/clients`
4. Agregar imports de `useState`, `toast`, `SearchInput`, `ConfirmDialog`, `Trash2`, `Button`
5. Agregar `<SearchInput placeholder="Buscar por nombre, teléfono o email..." />` al inicio del return
6. Agregar columna `"actions"` al final de columns
7. Agregar `handleDelete` function
8. Actualizar return para incluir wrapper `<div className="space-y-4">` + `SearchInput` + `DataTable` + `ConfirmDialog`

**Archivo page**: `src/app/clientes/page.tsx`
- Eliminar `import { SearchInput }`
- Eliminar `<SearchInput placeholder="..." />`

**Toast message**: `"Cliente eliminado"` y el error del result (que puede ser `"No se puede eliminar un cliente con pedidos asociados"`).

---

### 3d. Inventario

**Archivo**: `src/app/inventario/inventory-table.tsx` (ya movido en Phase 1)

**Cambios**:
1. Agregar `onRowClick={(row) => router.push(`/inventario/${row.id}`)}` al `DataTable`
2. Agregar `e.stopPropagation()` en el `<SelectTrigger>` de la columna de estado, para que el click en el dropdown no dispare el `onRowClick` de la fila:

```tsx
<SelectTrigger
  className="h-8 w-[140px]"
  onClick={(e) => e.stopPropagation()}
>
```

**Nota**: El componente ya tiene `useRouter` (verificar — si no lo tiene, agregar import). El botón de delete ya tiene `e.stopPropagation()`. El `ConfirmDialog` ya existe. Solo agregar `onRowClick` y el `stopPropagation` en el Select.

---

### 3e. Categorias

**Archivo tabla**: `src/app/categorias/categories-table.tsx`

**Cambios**:
1. Agregar `<SearchInput placeholder="Buscar por nombre o código..." />` al inicio del return
2. Agregar `onRowClick={(row) => router.push(`/categorias/${row.id}`)}` al `DataTable`
3. Agregar imports de `SearchInput`

**Cambios en page.tsx**: `src/app/categorias/page.tsx`
- Agregar `search` a `searchParams`: `Promise<{ search?: string }>`
- Leer y pasar `search` al llamar `getCategories({ search: params.search })`

**Nota**: El botón Pencil y Trash2 ya tienen `e.stopPropagation()`. Al agregar `onRowClick`, el click en esos botones NO propagará al handler de fila.

---

### 3f. Pagos

**Archivo tabla**: `src/app/pagos/payments-table.tsx`

**Cambios**:
1. Agregar `useState` para `deletingId` y `deleteLoading`
2. Agregar import de `deletePayment` desde `@/lib/actions/payments`
3. Agregar imports de `useState`, `toast`, `SearchInput`, `ConfirmDialog`, `Trash2`, `Button`
4. Agregar `<SearchInput placeholder="Buscar por cliente o # de pedido..." />` dentro del bloque de filtros (junto a los filtros de fecha y método)
5. Agregar `onRowClick={(row) => router.push(`/pagos/${row.id}`)}` al `DataTable`
   - El `<Link>` del pedido ya tiene `e.stopPropagation()`, así que el click en el link no disparará el `onRowClick`
6. Agregar columna `"actions"` al final de columns
7. Agregar `handleDelete` function
8. Agregar `<ConfirmDialog>` después del `DataTable`

**Cambios en page.tsx**: `src/app/pagos/page.tsx`
- Agregar `search?: string` a `searchParams`
- Pasar `search: params.search` a `getPayments()`

**Toast message**: `"Pago eliminado"` y el error del result.

> **Nota sobre deletePayment**: El backend de delete de pagos retorna `orderId` en el success. Actualmente la action `deletePayment` en `src/lib/actions/payments.ts` probablemente hace `revalidatePath` del pedido. Verificar que la action ya maneja esto correctamente antes de llamarla desde la tabla.

---

### Success Criteria Phase 3

#### Automated Verification:
- [x] TypeScript compila sin errores: `npx tsc --noEmit`

#### Manual Verification (por módulo):

**Pedidos:**
- [ ] La tabla muestra botón Trash2 en cada fila
- [ ] Click en fila navega a `/pedidos/{id}`
- [ ] Click en Trash2 abre ConfirmDialog
- [ ] Confirmar elimina el pedido (y payments/rental en cascada) y refresca la lista
- [ ] SearchInput sigue funcionando

**Gastos:**
- [ ] SearchInput aparece dentro del componente de tabla (no duplicado)
- [ ] La page.tsx no tiene SearchInput (verificar visualmente que no haya duplicado)
- [ ] Click en fila navega a `/gastos/{id}`
- [ ] Click en Trash2 elimina el gasto y refresca la lista

**Clientes:**
- [ ] SearchInput aparece dentro del componente de tabla (no duplicado)
- [ ] La page.tsx no tiene SearchInput
- [ ] Click en Trash2 elimina cliente sin pedidos
- [ ] Click en Trash2 para cliente CON pedidos muestra error toast (no elimina)

**Inventario:**
- [ ] Click en fila navega a `/inventario/{id}`
- [ ] Click en el dropdown de estado NO dispara navegación
- [ ] Click en Trash2 abre ConfirmDialog (comportamiento existente se preserva)

**Categorias:**
- [ ] SearchInput filtra por nombre y código
- [ ] Click en fila navega a `/categorias/{id}`
- [ ] Click en Pencil navega a `/categorias/{id}/editar` (NO a detail)
- [ ] Click en Trash2 elimina la categoría (comportamiento existente se preserva)

**Pagos:**
- [ ] SearchInput filtra por cliente y número de pedido
- [ ] Click en fila navega a `/pagos/{id}`
- [ ] Click en el link del pedido (columna Pedido) NO dispara navegación de fila
- [ ] Click en Trash2 elimina el pago

**Pausa aquí para confirmar Phase 3 antes de cerrar el plan.**

---

## Testing Strategy

### Manual Testing Steps (orden sugerido):
1. Verificar que `/productos` sigue funcionando sin cambios (regresión)
2. Probar cada módulo en orden: pedidos → gastos → clientes → inventario → categorias → pagos
3. Para cada módulo: buscar, clickear fila, clickear delete, confirmar, cancelar delete
4. Verificar que los módulos con guards de integridad muestran el error correcto (no eliminan)
5. Verificar que las 4 nuevas detail pages cargan desde la tabla y muestran datos correctos

### Casos de borde:
- Intentar eliminar un cliente con pedidos → debe mostrar toast de error, no eliminar
- Intentar eliminar una categoría con productos activos → debe mostrar toast de error
- Intentar eliminar un item de inventario vinculado a pedidos → debe mostrar toast de error
- Navegar a `/gastos/id-inexistente` → debe mostrar 404

---

## Performance Considerations

No hay implicaciones de performance significativas. Todos los cambios son UI-side o backend-side con queries simples por ID.

---

## Migration Notes

No se requieren migraciones de base de datos. Todos los cambios son:
- Código de la aplicación (UI + backend layers)
- Nuevas funciones en capas existentes
- Nuevas páginas

---

## References

- Research document: `thoughts/shared/research/2026-02-19_00-00-00_[general]_patron-modulos-tabla.md`
- Patrón de referencia (más completo hoy): `src/app/categorias/categories-table.tsx`
- Patrón de delete con guard: `src/features/clients/clients.service.ts:40`
- Patrón de detail page: `src/app/clientes/[id]/page.tsx`
- Patrón de cascade delete en repo: `src/features/orders/orders.repo.ts:103` (para updateInTransaction como referencia de style)
