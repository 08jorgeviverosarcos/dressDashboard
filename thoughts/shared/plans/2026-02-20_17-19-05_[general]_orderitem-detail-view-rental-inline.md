# OrderItem Detail View con Rental Inline — Plan de Implementación

## Overview

Crear una vista detalle individual por OrderItem (`/pedidos/[id]/items/[itemId]`) accesible al hacer click en la tabla de items del pedido. La vista muestra los datos del OrderItem y, si es tipo RENTAL, toda la funcionalidad de gestión de alquiler inline (crear, editar fechas/depósito, agregar/eliminar costos). También se agrega la opción de eliminar el OrderItem desde la tabla y desde su vista detalle. Se elimina la ruta `/pedidos/[id]/alquiler`.

## Current State Analysis

- **Tabla de items en `/pedidos/[id]`**: HTML estático (`<table>`), filas no clickeables, sin links, sin botón de eliminar individual.
- **Gestionar Alquiler** (`/pedidos/[id]/alquiler`): Página separada con `RentalManager` que carga todos los items RENTAL del pedido en tabs. Soporta crear/editar rental + costos.
- **No existe `deleteOrderItem`** en ninguna capa (action, service, repo). Los items solo se borran via update-all-items o cascade por delete de order.
- **Patrón de tablas clickeables**: `DataTable` con `onRowClick` → `router.push(...)`. Usado en `/clientes`, `/pedidos`, `/gastos`.
- **Patrón de detalle con delete**: `DeleteClientButton` en `src/app/clientes/[id]/delete-client-button.tsx`.
- **Prisma**: `Rental.orderItemId` tiene `onDelete: SetNull` (no cascada). Borrar `OrderItem` deja `Rental` huérfano. Borrar `Rental` sí cascadea `RentalCost`.

## Desired End State

### Estructura de rutas final:
```
/pedidos/[id]               → Tabla de items con DataTable (filas clickeables + trash icon)
/pedidos/[id]/items/[itemId] → Detalle OrderItem + RentalManager inline (si es RENTAL) + botón Eliminar
```

### La ruta `/pedidos/[id]/alquiler` **deja de existir**.

### Verificación:
- [ ] Click en fila de item en `/pedidos/[id]` navega a `/pedidos/[id]/items/[itemId]`
- [ ] Botón trash en tabla muestra ConfirmDialog y elimina el item (con su rental + costos si los tiene)
- [ ] `/pedidos/[id]/items/[itemId]` muestra datos del OrderItem
- [ ] Si itemType === "RENTAL": muestra sección de gestión de alquiler completa
- [ ] Crear rental funciona desde el detalle del item
- [ ] Editar fechas/depósito del rental funciona
- [ ] Agregar/eliminar costos de rental funcionan
- [ ] Botón Eliminar en detalle del item borra el item y navega a `/pedidos/${orderId}`
- [ ] `/pedidos/[id]/alquiler` retorna 404
- [ ] Totales del pedido se recalculan correctamente tras eliminar un item

### Key Discoveries:
- `src/app/pedidos/[id]/page.tsx:166-234` — Tabla HTML estática a reemplazar
- `src/app/pedidos/[id]/page.tsx:53-58` — Botón "Gestionar Alquiler" a eliminar
- `src/app/pedidos/[id]/alquiler/rental-manager.tsx` — Se mueve a items/[itemId]/
- `src/components/shared/DataTable.tsx` — Componente reutilizable (onRowClick, cursor-pointer)
- `src/app/clientes/clients-table.tsx` — Patrón exact a seguir (DataTable + trash + ConfirmDialog)
- `src/app/clientes/[id]/delete-client-button.tsx` — Patrón exact a seguir (delete desde detalle)
- `prisma/schema.prisma:155-165` — Rental onDelete: SetNull (la eliminación del rental debe ser explícita)

## What We're NOT Doing

- ❌ No modificar el `OrderForm` ni la lógica de creación/edición de pedidos
- ❌ No cambiar la pantalla `/pedidos/[id]/editar`
- ❌ No agregar edición individual de campos del OrderItem (editar sigue siendo via OrderForm completo)
- ❌ No cambiar el schema de Prisma (no se cambia `onDelete: SetNull` a `Cascade`)
- ❌ No modificar las rental actions existentes (`createRental`, `updateRental`, etc.)
- ❌ No agregar paginación ni búsqueda en la tabla de items
- ❌ No refactorizar el `RentalManager` — solo moverlo, verbatim

## Implementation Approach

Cuatro fases secuenciales. Cada fase es funcional y verificable por separado. Las fases 1 y 2 son backend/UI respectivamente. La fase 3 migra la tabla. La fase 4 limpia la ruta obsoleta.

---

## Phase 1: Backend — `deleteOrderItem` en todas las capas

### Overview
Agregar `deleteOrderItem` en repo, service y action. La lógica: el service computa los nuevos totales del pedido (restando el item eliminado), el repo ejecuta la eliminación + actualización de totales en una transacción atómica.

### Changes Required:

#### 1. Repo — `src/features/orders/orders.repo.ts`

Agregar al final del archivo dos funciones nuevas:

**`findOrderItemForDeletion`** — fetch del item con rental y los items restantes del pedido para calcular totales:
```ts
export function findOrderItemForDeletion(id: string) {
  return prisma.orderItem.findUnique({
    where: { id },
    include: {
      rental: { select: { id: true } },
      order: {
        include: {
          items: true,
        },
      },
    },
  });
}
```

**`findOrderItemById`** — fetch completo para la vista detalle:
```ts
export function findOrderItemById(id: string) {
  return prisma.orderItem.findUnique({
    where: { id },
    include: {
      product: true,
      inventoryItem: true,
      expenses: { orderBy: { date: "desc" } },
      rental: { include: { costs: { orderBy: { type: "asc" } } } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          clientId: true,
        },
      },
    },
  });
}
```

**`deleteOrderItemAndUpdateTotals`** — transacción que elimina rental (explícita, por onDelete:SetNull), elimina el item, y actualiza totales de la orden:
```ts
export function deleteOrderItemAndUpdateTotals(
  orderItemId: string,
  orderId: string,
  rentalId: string | null,
  newTotalPrice: number,
  newTotalCost: number
) {
  return prisma.$transaction(async (tx) => {
    if (rentalId) {
      await tx.rental.delete({ where: { id: rentalId } });
    }
    await tx.orderItem.delete({ where: { id: orderItemId } });
    await tx.order.update({
      where: { id: orderId },
      data: { totalPrice: newTotalPrice, totalCost: newTotalCost },
    });
  });
}
```

#### 2. Service — `src/features/orders/orders.service.ts`

Agregar dos funciones nuevas. Importar `toDecimalNumber` desde `@/lib/utils`:

```ts
import { toDecimalNumber } from "@/lib/utils";
```

**`getOrderItem`**:
```ts
export function getOrderItem(id: string) {
  return repo.findOrderItemById(id);
}
```

**`deleteOrderItem`** — compute totals en el service (business logic), delega la transacción al repo:
```ts
export async function deleteOrderItem(
  id: string
): Promise<ActionResult<{ orderId: string }>> {
  const orderItem = await repo.findOrderItemForDeletion(id);
  if (!orderItem) {
    return { success: false, error: "Item no encontrado" };
  }

  const orderId = orderItem.orderId;
  const rentalId = orderItem.rental?.id ?? null;

  // Calcular nuevos totales excluyendo el item a eliminar
  const remainingItems = orderItem.order.items.filter((i) => i.id !== id);
  let itemsSubtotal = 0;
  let newTotalCost = 0;
  for (const item of remainingItems) {
    const lineTotal = item.quantity * toDecimalNumber(item.unitPrice);
    const discountVal = item.discountValue ? toDecimalNumber(item.discountValue) : 0;
    const subtotal =
      item.discountType === "FIXED"
        ? lineTotal - discountVal
        : item.discountType === "PERCENTAGE"
          ? lineTotal * (1 - discountVal / 100)
          : lineTotal;
    itemsSubtotal += subtotal;
    newTotalCost += item.quantity * toDecimalNumber(item.costAmount);
  }
  const newTotalPrice =
    itemsSubtotal + toDecimalNumber(orderItem.order.adjustmentAmount);

  await repo.deleteOrderItemAndUpdateTotals(
    id,
    orderId,
    rentalId,
    newTotalPrice,
    newTotalCost
  );

  return { success: true, data: { orderId } };
}
```

**Nota**: `orderItem.order.adjustmentAmount` requiere que `findOrderItemForDeletion` incluya `adjustmentAmount` en el select del order. Agregar `adjustmentAmount: true` al select del order en esa query.

#### 3. Action — `src/lib/actions/orders.ts`

Agregar al final dos nuevas exported functions:

```ts
export async function getOrderItem(id: string) {
  return service.getOrderItem(id);
}

export async function deleteOrderItem(id: string): Promise<ActionResult<{ orderId: string }>> {
  const result = await service.deleteOrderItem(id);
  if (result.success) {
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${result.data.orderId}`);
  }
  return result;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila sin errores: `npx tsc --noEmit`

#### Manual Verification:
- [ ] (Verificar en Phase 2/3 cuando la UI esté conectada)

**Pausa aquí para confirmar que TypeScript no reporta errores antes de continuar.**

---

## Phase 2: Vista Detalle de OrderItem

### Overview
Nueva ruta `/pedidos/[id]/items/[itemId]` con página server component que muestra los datos del item y, si es RENTAL, el `RentalManager` completo. Incluye botón Eliminar con patrón idéntico a `delete-client-button.tsx`. El `rental-manager.tsx` se mueve de `/alquiler/` a `/items/[itemId]/` sin cambios.

### Changes Required:

#### 1. Mover RentalManager

**Origen**: `src/app/pedidos/[id]/alquiler/rental-manager.tsx`
**Destino**: `src/app/pedidos/[id]/items/[itemId]/rental-manager.tsx`
**Cambios**: Ninguno — copiar verbatim.

#### 2. DeleteOrderItemButton — `src/app/pedidos/[id]/items/[itemId]/delete-order-item-button.tsx`

Patrón idéntico a `src/app/clientes/[id]/delete-client-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteOrderItem } from "@/lib/actions/orders";

interface DeleteOrderItemButtonProps {
  orderItemId: string;
  itemName: string;
  orderId: string;
}

export function DeleteOrderItemButton({
  orderItemId,
  itemName,
  orderId,
}: DeleteOrderItemButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await deleteOrderItem(orderItemId);

    if (result.success) {
      toast.success("Item eliminado");
      router.push(`/pedidos/${orderId}`);
    } else {
      toast.error(result.error);
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        Eliminar
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Eliminar item"
        description={`¿Estás seguro de que deseas eliminar "${itemName}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={loading}
      />
    </>
  );
}
```

#### 3. Página detalle — `src/app/pedidos/[id]/items/[itemId]/page.tsx`

Server component. Obtiene el item con `getOrderItem(itemId)`. Muestra:
- `PageHeader` con title=`item.name`, backHref=`/pedidos/${id}`
- Botón `DeleteOrderItemButton`
- Card "Información del Item" con: Tipo (badge), Nombre, Descripción (si existe), Cantidad, Precio unitario, Descuento (si existe), Costo, Subtotal calculado
- Si `item.itemType === "RENTAL"`: `<RentalManager>` con rental (serializado) o null

```tsx
import { notFound } from "next/navigation";
import { getOrderItem } from "@/lib/actions/orders";
import { getRental } from "@/lib/actions/rentals";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, toDecimalNumber } from "@/lib/utils";
import { DeleteOrderItemButton } from "./delete-order-item-button";
import { RentalManager } from "./rental-manager";

interface Props {
  params: Promise<{ id: string; itemId: string }>;
}

export default async function OrderItemDetailPage({ params }: Props) {
  const { id, itemId } = await params;
  const item = await getOrderItem(itemId);

  if (!item || item.order.id !== id) return notFound();

  const lineTotal = item.quantity * toDecimalNumber(item.unitPrice);
  const discountVal = item.discountValue ? toDecimalNumber(item.discountValue) : 0;
  const subtotal =
    item.discountType === "FIXED"
      ? lineTotal - discountVal
      : item.discountType === "PERCENTAGE"
        ? lineTotal * (1 - discountVal / 100)
        : lineTotal;

  const rental = item.itemType === "RENTAL"
    ? await getRental(item.id)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.name}
        description={`Pedido #${item.order.orderNumber}`}
        backHref={`/pedidos/${id}`}
      />

      <div className="flex gap-2">
        <DeleteOrderItemButton
          orderItemId={item.id}
          itemName={item.name}
          orderId={id}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <Badge variant="outline">
              {item.itemType === "SALE"
                ? "Venta"
                : item.itemType === "RENTAL"
                  ? "Alquiler"
                  : "Servicio"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre</span>
            <span>{item.name}</span>
          </div>
          {item.description && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descripción</span>
              <span>{item.description}</span>
            </div>
          )}
          {item.product && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código</span>
              <span>{item.product.code}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cantidad</span>
            <span>{item.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precio unitario</span>
            <span>{formatCurrency(item.unitPrice)}</span>
          </div>
          {item.discountType && item.discountValue && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span>
                {item.discountType === "PERCENTAGE"
                  ? `${toDecimalNumber(item.discountValue)}%`
                  : formatCurrency(item.discountValue)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Costo</span>
            <span>{formatCurrency(item.costAmount)}</span>
          </div>
          <div className="flex justify-between font-medium border-t pt-3">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        </CardContent>
      </Card>

      {item.itemType === "RENTAL" && (
        <RentalManager
          orderId={id}
          orderItemId={item.id}
          rental={rental ? JSON.parse(JSON.stringify(rental)) : null}
        />
      )}
    </div>
  );
}
```

**Nota importante**: `getRental` en `src/lib/actions/rentals.ts` toma `orderItemId` y retorna el rental con costs, orderItem, y order. La firma actual de `RentalManager` recibe `rental: RentalData | null`. El `JSON.parse(JSON.stringify(rental))` serializa los Decimal fields, igual que en la página de alquiler original.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila sin errores: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Navegar directamente a `/pedidos/[id]/items/[itemId]` muestra los datos del item
- [ ] Si es tipo RENTAL: muestra sección de alquiler
- [ ] Si es tipo SALE/SERVICE: NO muestra sección de alquiler
- [ ] Crear rental funciona (si no existía)
- [ ] Editar rental (fechas + depósito) funciona
- [ ] Agregar costo al rental funciona
- [ ] Eliminar costo del rental funciona (con ConfirmDialog)
- [ ] Botón "Eliminar" muestra ConfirmDialog y elimina el item
- [ ] Tras eliminar, redirige a `/pedidos/${orderId}`
- [ ] Los totales del pedido se actualizan correctamente en la vista de detalle del pedido

**Pausa aquí para verificación manual completa antes de continuar.**

---

## Phase 3: Migrar tabla de items a DataTable + quitar "Gestionar Alquiler"

### Overview
Convertir la tabla HTML estática de items en el detalle del pedido a un client component `OrderItemsTable` que usa `DataTable` con `onRowClick`. Agregar columna de acciones con botón trash (delete inline). Eliminar el botón "Gestionar Alquiler" del header y la variable `hasRental`.

### Changes Required:

#### 1. Nuevo client component — `src/app/pedidos/[id]/order-items-table.tsx`

Patrón idéntico a `src/app/clientes/clients-table.tsx` (DataTable + onRowClick + trash + ConfirmDialog):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteOrderItem } from "@/lib/actions/orders";
import { formatCurrency, toDecimalNumber } from "@/lib/utils";

// Tipo serializado (Decimal → string | number)
interface OrderItemRow {
  id: string;
  itemType: "SALE" | "RENTAL" | "SERVICE";
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number | string;
  discountType: "FIXED" | "PERCENTAGE" | null;
  discountValue: number | string | null;
  costAmount: number | string;
  product: { code: string } | null;
}

interface OrderItemsTableProps {
  items: OrderItemRow[];
  orderId: string;
}

export function OrderItemsTable({ items, orderId }: OrderItemsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteLoading(true);
    const result = await deleteOrderItem(deletingId);
    setDeleteLoading(false);
    setDeletingId(null);
    if (result.success) {
      toast.success("Item eliminado");
    } else {
      toast.error(result.error);
    }
  }

  const columns: Column<OrderItemRow>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (row) => (
        <Badge variant="outline">
          {row.itemType === "SALE"
            ? "Venta"
            : row.itemType === "RENTAL"
              ? "Alquiler"
              : "Servicio"}
        </Badge>
      ),
    },
    {
      key: "nombre",
      header: "Nombre",
      cell: (row) => (
        <div>
          <div>{row.name}</div>
          {row.description && (
            <div className="text-xs text-muted-foreground">{row.description}</div>
          )}
          {row.product && (
            <div className="text-xs text-muted-foreground">Cod: {row.product.code}</div>
          )}
        </div>
      ),
    },
    {
      key: "cantidad",
      header: "Cant.",
      className: "text-center",
      cell: (row) => row.quantity,
    },
    {
      key: "precioUnit",
      header: "Precio Unit.",
      className: "text-right",
      cell: (row) => formatCurrency(row.unitPrice),
    },
    {
      key: "descuento",
      header: "Descuento",
      className: "text-right",
      cell: (row) =>
        row.discountType && row.discountValue
          ? row.discountType === "PERCENTAGE"
            ? `${toDecimalNumber(row.discountValue)}%`
            : formatCurrency(row.discountValue)
          : "—",
    },
    {
      key: "costo",
      header: "Costo",
      className: "text-right",
      cell: (row) => formatCurrency(row.costAmount),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      className: "text-right",
      cell: (row) => {
        const lineTotal = row.quantity * toDecimalNumber(row.unitPrice);
        const discountVal = row.discountValue ? toDecimalNumber(row.discountValue) : 0;
        const subtotal =
          row.discountType === "FIXED"
            ? lineTotal - discountVal
            : row.discountType === "PERCENTAGE"
              ? lineTotal * (1 - discountVal / 100)
              : lineTotal;
        return <span className="font-medium">{formatCurrency(subtotal)}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingId(row.id);
              setDeletingName(row.name);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        onRowClick={(row) => router.push(`/pedidos/${orderId}/items/${row.id}`)}
        emptyMessage="Sin items en este pedido"
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Eliminar item"
        description={`¿Estás seguro de que deseas eliminar "${deletingName}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
```

#### 2. Actualizar `src/app/pedidos/[id]/page.tsx`

**Cambios específicos:**

1. Agregar import de `OrderItemsTable`:
```ts
import { OrderItemsTable } from "./order-items-table";
```

2. Eliminar import de `Badge` si ya no se usa en otro lugar (verificar antes — actualmente se usa para el badge "Alquiler" en la sección de status).

3. Eliminar cálculo de `hasRental` (línea 24).

4. Eliminar botón "Gestionar Alquiler" (líneas 53-59) — queda solo el botón "Editar".

5. Reemplazar la sección "Items Table" (líneas 166-234) con:
```tsx
{/* Items Table */}
<Card>
  <CardHeader>
    <CardTitle>Items del Pedido ({order.items.length})</CardTitle>
  </CardHeader>
  <CardContent>
    <OrderItemsTable
      items={JSON.parse(JSON.stringify(order.items))}
      orderId={id}
    />
  </CardContent>
</Card>
```

**Nota**: El `Badge` import se puede conservar si se sigue usando para el badge "Alquiler" en el bloque de status. Verificar si `hasRental` se usa en algún otro lugar del archivo antes de eliminarlo.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compila sin errores: `npx tsc --noEmit`

#### Manual Verification:
- [ ] La tabla de items en `/pedidos/[id]` muestra los items con filas clickeables (cursor-pointer)
- [ ] Click en fila navega a `/pedidos/[id]/items/[itemId]`
- [ ] El botón trash en la fila muestra ConfirmDialog (sin navegar)
- [ ] Confirmar elimina el item y la tabla se actualiza
- [ ] El botón "Gestionar Alquiler" ya no aparece
- [ ] Los datos de la tabla (tipo, nombre, cant., precio, descuento, costo, subtotal) son idénticos a los anteriores
- [ ] El badge "Alquiler" en el header del pedido (si aún se usa `hasRental`) se mantiene o elimina apropiadamente

**Pausa aquí para verificación manual completa antes de continuar.**

---

## Phase 4: Eliminar ruta `/pedidos/[id]/alquiler`

### Overview
Borrar los archivos de la ruta de alquiler. El `rental-manager.tsx` ya fue movido en Phase 2, así que aquí solo se borra el `page.tsx` de alquiler.

### Changes Required:

#### 1. Eliminar `src/app/pedidos/[id]/alquiler/page.tsx`

Verificar primero que:
- `rental-manager.tsx` ya existe en `src/app/pedidos/[id]/items/[itemId]/rental-manager.tsx`
- No hay ningún otro archivo en `src/app/pedidos/[id]/alquiler/`

Luego eliminar:
- `src/app/pedidos/[id]/alquiler/page.tsx`
- El directorio `src/app/pedidos/[id]/alquiler/` (si queda vacío)

#### 2. Verificar que no hay links a `/alquiler` en el resto del codebase

Buscar referencias a `/alquiler` en el código fuente. Tras Phase 3, el único link que existía era el botón "Gestionar Alquiler" en `/pedidos/[id]/page.tsx` que ya fue eliminado.

### Success Criteria:

#### Automated Verification:
- [ ] No existen referencias a `/alquiler` en el codebase: `grep -r "alquiler" src/app --include="*.tsx" --include="*.ts"`
- [ ] TypeScript compila sin errores: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Navegar a `/pedidos/[id]/alquiler` retorna 404
- [ ] Ningún link en la UI apunta a `/alquiler`
- [ ] El flujo completo funciona: Lista pedidos → Detalle pedido → Click item → Detalle item → Gestionar rental

---

## Testing Strategy

### Manual Testing Steps (flujo completo):

1. Abrir `/pedidos` → seleccionar un pedido con items de tipo RENTAL
2. En el detalle del pedido, verificar que la tabla de items tiene cursor-pointer en las filas
3. Click en un item tipo RENTAL → debe navegar a `/pedidos/[id]/items/[itemId]`
4. Verificar que se muestran los datos del item (tipo badge, nombre, cantidad, precio, costo, subtotal)
5. Verificar que aparece la sección de gestión de alquiler (si el rental ya existe: ver fechas, depósito, costos)
6. Si no tiene rental: crear uno con fecha de devolución y depósito → verificar que aparece
7. Editar fechas del alquiler → guardar → verificar que se actualizan
8. Agregar un costo al alquiler → verificar que aparece en la lista con el total
9. Eliminar el costo → verificar que desaparece
10. Click en el botón "Eliminar" del item → confirmar → verificar redirección a detalle del pedido
11. Verificar que el item eliminado ya no aparece en la tabla y los totales del pedido son correctos
12. Abrir un item tipo SALE → verificar que NO hay sección de alquiler
13. Intentar acceder a `/pedidos/[id]/alquiler` → debe dar 404

### Smoke Tests por módulo (de CLAUDE.md):
- [ ] Lista de pedidos carga correctamente
- [ ] Crear pedido funciona
- [ ] Editar pedido funciona
- [ ] No cambio en mensajes de error
- [ ] No regresión en totales o pagos

## Migration Notes

No hay migración de datos. No hay cambios en el schema de Prisma.

El `onDelete: SetNull` en `Rental.orderItemId` se conserva como está. La eliminación explícita del Rental en `deleteOrderItemAndUpdateTotals` asegura que no queden rentals huérfanos al eliminar un item vía la nueva acción.

## References

- Research: `thoughts/shared/research/2026-02-20_17-02-13_[general]_orderitem-detail-view-rental-inline-refactor.md`
- Patrón tabla clickeable: `src/app/clientes/clients-table.tsx`
- Patrón delete en detalle: `src/app/clientes/[id]/delete-client-button.tsx`
- Patrón detalle simple: `src/app/gastos/[id]/page.tsx`
- Tabla de items actual: `src/app/pedidos/[id]/page.tsx:166-234`
- RentalManager actual: `src/app/pedidos/[id]/alquiler/rental-manager.tsx`
- Repo orders: `src/features/orders/orders.repo.ts`
- Service orders: `src/features/orders/orders.service.ts`
- Actions orders: `src/lib/actions/orders.ts`
