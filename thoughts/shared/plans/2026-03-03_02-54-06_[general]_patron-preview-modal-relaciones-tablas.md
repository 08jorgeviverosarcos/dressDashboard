---
date: "2026-03-03T02:54:06Z"
researcher: Claude
git_commit: ca21d88
branch: main
repository: dressDashboard
topic: "Patrón de preview modal para entidades relacionadas en tablas"
tags: [plan, tables, modals, preview, pattern, related-entities]
status: complete
last_updated: "2026-03-03"
last_updated_by: Claude
---

# Patrón Preview Modal para Entidades Relacionadas en Tablas — Plan de Implementacion

## Overview

Crear un patrón reutilizable donde las columnas de tablas que muestran datos de entidades relacionadas (ej: nombre de producto en inventario, nombre de cliente en pedidos) sean clickeables y abran un modal de vista previa con la informacion principal de esa entidad. El modal incluye un boton "Ver detalle completo" para navegar a la pagina de detalle.

## Current State Analysis

### Estado actual de las tablas:
- **6 de 8 tablas** muestran relaciones como texto plano (no clickeable)
- Solo `payments-table.tsx` y `gastos-table.tsx` tienen `<Link>` en celdas (navegan a pagina completa)
- No existe ningun dialog/modal de "vista previa" o "detalle rapido" en el codebase
- Todos los detalles se ven en paginas completas server-rendered (`[id]/page.tsx`)

### Datos disponibles:
- Todas las queries del repo usan `include: true` → los modelos completos (con `id`) ya estan en los datos
- Las interfaces TypeScript de las tablas son mas estrechas que los datos reales (ej: `OrderRow.client: { name: string }` pero el dato real tiene `{ id, name, phone, email, ... }`)
- Ya existen server actions de detalle: `getProduct(id)`, `getClient(id)`, `getCategory(id)`

### Key Discoveries:
- `src/features/orders/orders.repo.ts:30-38` — `client: true` retorna modelo completo con `id`
- `src/features/inventory/inventory.repo.ts:20-24` — `product: true` retorna modelo completo con `id`
- `src/features/payments/payments.repo.ts:29-33` — `order: { include: { client: true } }` retorna client con `id`
- `src/components/shared/DataTable.tsx:56-59` — `stopPropagation` ya es patron establecido para clicks en celdas

## Desired End State

1. En cada tabla donde se muestre el nombre de una entidad relacionada, ese texto es clickeable (estilo link: `text-primary hover:underline`)
2. Al hacer click, se abre un dialog modal con la informacion principal de esa entidad (fetch via server action)
3. El modal tiene un boton "Ver detalle completo" que navega a la pagina de detalle
4. El patron esta documentado en CLAUDE.md para que nuevos modulos lo implementen igual

### Verificacion:
- Click en "Producto" en tabla de inventario → modal con info del producto
- Click en "Cliente" en tabla de pedidos → modal con info del cliente
- Click en "Categoria" en tabla de productos → modal con info de la categoria
- El click NO navega a otra pagina (el `onRowClick` de la fila no se dispara)
- El boton "Ver detalle completo" si navega a la pagina de detalle

## What We're NOT Doing

- NO modificar las paginas de detalle existentes (`[id]/page.tsx`)
- NO modificar las queries Prisma de los repos (los datos ya estan completos)
- NO crear un componente generico abstracto (`EntityPreviewModal<T>`) — cada entidad tiene su modal especifico siguiendo el mismo patron interno
- NO modificar `gastos-table.tsx` (ya tiene link a pedido y es suficiente)
- NO agregar preview modal en las paginas de detalle que usan `<table>` inline (esas ya estan en contexto de detalle)

## Implementation Approach

Crear **modales de preview por entidad** (no un componente generico). Cada modal:
1. Recibe `entityId: string | null` (null = cerrado)
2. Hace fetch con el server action existente cuando se abre
3. Muestra loading state, luego key-value rows
4. Tiene boton "Ver detalle completo" + "Cerrar"

Luego modificar cada tabla:
1. Ampliar la interface TypeScript para incluir `id` de la relacion (los datos ya lo tienen)
2. Cambiar el cell renderer de texto plano a `<button>` clickeable
3. Agregar estado `previewId` + el modal correspondiente

---

## Phase 1: Crear Preview Modals por Entidad

### Overview
Crear 3 componentes de preview modal, uno por entidad: Product, Client, Category. Cada uno sigue el mismo patron interno.

### Changes Required:

#### 1. ProductPreviewModal
**File**: `src/features/products/components/ProductPreviewModal.tsx` (NUEVO)

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { getProduct } from "@/lib/actions/products";
import { formatCurrency } from "@/lib/utils";
import {
  PRODUCT_TYPE_LABELS,
  INVENTORY_TRACKING_LABELS,
} from "@/lib/constants/categories";

interface ProductPreviewModalProps {
  productId: string | null;
  onClose: () => void;
}

export function ProductPreviewModal({ productId, onClose }: ProductPreviewModalProps) {
  const [product, setProduct] = useState<Awaited<ReturnType<typeof getProduct>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productId) {
      setLoading(true);
      setProduct(null);
      getProduct(productId).then((data) => {
        setProduct(data);
        setLoading(false);
      });
    }
  }, [productId]);

  return (
    <Dialog open={!!productId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{loading ? "Cargando..." : product?.name ?? "Producto"}</DialogTitle>
          {product?.code && (
            <p className="text-sm text-muted-foreground">{product.code}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : product ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <Badge variant="secondary">{PRODUCT_TYPE_LABELS[product.type]}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inventario</span>
              <span>{INVENTORY_TRACKING_LABELS[product.inventoryTracking]}</span>
            </div>
            {product.category && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria</span>
                <span>{product.category.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio Venta</span>
              <span className="font-medium">
                {product.salePrice ? formatCurrency(product.salePrice) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio Alquiler</span>
              <span className="font-medium">
                {product.rentalPrice ? formatCurrency(product.rentalPrice) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo</span>
              <span className="font-medium">
                {product.cost ? formatCurrency(product.cost) : "—"}
              </span>
            </div>
            {product.description && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Descripcion</span>
                <p className="mt-1">{product.description}</p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {productId && (
            <Button asChild>
              <Link href={`/productos/${productId}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver detalle completo
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 2. ClientPreviewModal
**File**: `src/features/clients/components/ClientPreviewModal.tsx` (NUEVO)

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Phone, Mail, FileText } from "lucide-react";
import { getClient } from "@/lib/actions/clients";
import { formatDate } from "@/lib/utils";

interface ClientPreviewModalProps {
  clientId: string | null;
  onClose: () => void;
}

export function ClientPreviewModal({ clientId, onClose }: ClientPreviewModalProps) {
  const [client, setClient] = useState<Awaited<ReturnType<typeof getClient>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clientId) {
      setLoading(true);
      setClient(null);
      getClient(clientId).then((data) => {
        setClient(data);
        setLoading(false);
      });
    }
  }, [clientId]);

  return (
    <Dialog open={!!clientId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{loading ? "Cargando..." : client?.name ?? "Cliente"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : client ? (
          <div className="space-y-3 text-sm">
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {client.phone}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {client.email}
              </div>
            )}
            {client.notes && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {client.notes}
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Cliente desde</span>
              <span>{formatDate(client.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedidos</span>
              <span className="font-medium">{client.orders.length}</span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {clientId && (
            <Button asChild>
              <Link href={`/clientes/${clientId}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver detalle completo
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3. CategoryPreviewModal
**File**: `src/features/categories/components/CategoryPreviewModal.tsx` (NUEVO)

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { getCategory } from "@/lib/actions/categories";

interface CategoryPreviewModalProps {
  categoryId: string | null;
  onClose: () => void;
}

export function CategoryPreviewModal({ categoryId, onClose }: CategoryPreviewModalProps) {
  const [category, setCategory] = useState<Awaited<ReturnType<typeof getCategory>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (categoryId) {
      setLoading(true);
      setCategory(null);
      getCategory(categoryId).then((data) => {
        setCategory(data);
        setLoading(false);
      });
    }
  }, [categoryId]);

  return (
    <Dialog open={!!categoryId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{loading ? "Cargando..." : category?.name ?? "Categoria"}</DialogTitle>
          {category?.code && (
            <p className="text-sm text-muted-foreground">{category.code}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : category ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Codigo</span>
              <span className="font-medium">{category.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Productos activos</span>
              <span className="font-medium">{category.products.length}</span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {categoryId && (
            <Button asChild>
              <Link href={`/categorias/${categoryId}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver detalle completo
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Los 3 archivos se crean correctamente

#### Manual Verification:
- [x] Los modales no se importan aun en ninguna tabla (se prueban en Phase 2)

**Implementation Note**: Pausar aqui para confirmacion manual antes de Phase 2.

---

## Phase 2: Actualizar Tablas con Celdas Clickeables

### Overview
Modificar 5 tablas para que las columnas de relaciones sean clickeables y abran el preview modal correspondiente.

### Changes Required:

#### 1. inventory-table.tsx — Producto → ProductPreviewModal
**File**: `src/app/(dashboard)/inventario/inventory-table.tsx`

**Cambios:**
1. Importar `ProductPreviewModal`
2. Agregar estado `previewProductId`
3. Cambiar la celda "Producto" de texto plano a `<button>` clickeable
4. Renderizar `<ProductPreviewModal>`

```tsx
// Agregar import
import { ProductPreviewModal } from "@/features/products/components/ProductPreviewModal";

// Agregar estado dentro del componente
const [previewProductId, setPreviewProductId] = useState<string | null>(null);

// Cambiar la columna "name" (linea 84):
// ANTES:
{ key: "name", header: "Producto", cell: (row) => row.product.name },

// DESPUES:
{
  key: "name",
  header: "Producto",
  cell: (row) => (
    <button
      className="text-primary hover:underline text-left"
      onClick={(e) => {
        e.stopPropagation();
        setPreviewProductId(row.product.id);
      }}
    >
      {row.product.name}
    </button>
  ),
},

// Agregar el modal al final del JSX (dentro del fragment o div):
<ProductPreviewModal
  productId={previewProductId}
  onClose={() => setPreviewProductId(null)}
/>
```

#### 2. orders-table.tsx — Cliente → ClientPreviewModal
**File**: `src/app/(dashboard)/pedidos/orders-table.tsx`

**Cambios:**
1. Ampliar interface `OrderRow.client` para incluir `id`
2. Importar `ClientPreviewModal`
3. Agregar estado `previewClientId`
4. Cambiar la celda "Cliente" a clickeable
5. Renderizar `<ClientPreviewModal>`

```tsx
// Cambiar la interface (linea 25):
// ANTES:
client: { name: string };
// DESPUES:
client: { id: string; name: string };

// Agregar import
import { ClientPreviewModal } from "@/features/clients/components/ClientPreviewModal";

// Agregar estado
const [previewClientId, setPreviewClientId] = useState<string | null>(null);

// Cambiar la columna "client" (linea 69):
// ANTES:
{ key: "client", header: "Cliente", cell: (row) => row.client.name },

// DESPUES:
{
  key: "client",
  header: "Cliente",
  cell: (row) => (
    <button
      className="text-primary hover:underline text-left"
      onClick={(e) => {
        e.stopPropagation();
        setPreviewClientId(row.client.id);
      }}
    >
      {row.client.name}
    </button>
  ),
},

// Agregar el modal al JSX
<ClientPreviewModal
  clientId={previewClientId}
  onClose={() => setPreviewClientId(null)}
/>
```

#### 3. products-table.tsx — Categoria → CategoryPreviewModal
**File**: `src/app/(dashboard)/productos/products-table.tsx`

**Cambios:**
1. Importar `CategoryPreviewModal`
2. Agregar estado `previewCategoryId`
3. Cambiar la celda "Categoria" a clickeable (con null guard)
4. Renderizar `<CategoryPreviewModal>`

```tsx
// Agregar import
import { CategoryPreviewModal } from "@/features/categories/components/CategoryPreviewModal";

// Agregar estado
const [previewCategoryId, setPreviewCategoryId] = useState<string | null>(null);

// Cambiar la columna "category" (lineas 54-58):
// ANTES:
{
  key: "category",
  header: "Categoria",
  cell: (row) => row.category?.name ?? "-",
},

// DESPUES:
{
  key: "category",
  header: "Categoria",
  cell: (row) =>
    row.category ? (
      <button
        className="text-primary hover:underline text-left"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewCategoryId(row.category!.id);
        }}
      >
        {row.category.name}
      </button>
    ) : (
      "-"
    ),
},

// Agregar import de useState (ya se usa useRouter, pathname, searchParams)
import { useState } from "react";

// Agregar el modal al JSX
<CategoryPreviewModal
  categoryId={previewCategoryId}
  onClose={() => setPreviewCategoryId(null)}
/>
```

#### 4. order-items-table.tsx — Producto → ProductPreviewModal
**File**: `src/app/(dashboard)/pedidos/[id]/order-items-table.tsx`

**Cambios:**
1. Ampliar interface `OrderItemRow.product` para incluir `id` y `name`
2. Importar `ProductPreviewModal`
3. Agregar estado `previewProductId`
4. Cambiar el cell renderer del codigo de producto para ser clickeable
5. Renderizar `<ProductPreviewModal>`

```tsx
// Cambiar la interface (linea 25):
// ANTES:
product: { code: string } | null;
// DESPUES:
product: { id: string; code: string; name: string } | null;

// Agregar import
import { ProductPreviewModal } from "@/features/products/components/ProductPreviewModal";

// Agregar estado
const [previewProductId, setPreviewProductId] = useState<string | null>(null);

// Cambiar la columna "nombre" (lineas 68-80):
// ANTES:
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

// DESPUES:
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
        <button
          className="text-xs text-primary hover:underline text-left"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewProductId(row.product!.id);
          }}
        >
          Cod: {row.product.code}
        </button>
      )}
    </div>
  ),
},

// Agregar el modal al JSX
<ProductPreviewModal
  productId={previewProductId}
  onClose={() => setPreviewProductId(null)}
/>
```

#### 5. payments-table.tsx — Cliente → ClientPreviewModal
**File**: `src/app/(dashboard)/pagos/payments-table.tsx`

**Cambios:**
1. Ampliar interface `PaymentRow.order.client` para incluir `id`
2. Importar `ClientPreviewModal`
3. Agregar estado `previewClientId`
4. Cambiar la celda "Cliente" de texto plano a clickeable
5. Renderizar `<ClientPreviewModal>`

```tsx
// Cambiar la interface (linea 29):
// ANTES:
client: { name: string };
// DESPUES:
client: { id: string; name: string };

// Agregar import
import { ClientPreviewModal } from "@/features/clients/components/ClientPreviewModal";

// Agregar estado
const [previewClientId, setPreviewClientId] = useState<string | null>(null);

// Cambiar la columna "client" (linea 91):
// ANTES:
{ key: "client", header: "Cliente", cell: (row) => row.order.client.name },

// DESPUES:
{
  key: "client",
  header: "Cliente",
  cell: (row) => (
    <button
      className="text-primary hover:underline text-left"
      onClick={(e) => {
        e.stopPropagation();
        setPreviewClientId(row.order.client.id);
      }}
    >
      {row.order.client.name}
    </button>
  ),
},

// Agregar el modal al JSX
<ClientPreviewModal
  clientId={previewClientId}
  onClose={() => setPreviewClientId(null)}
/>
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [ ] Linting passes (si esta configurado)
- [ ] Build exitoso: `npm run build`

#### Manual Verification:
- [ ] En `/inventario`: click en nombre de producto → modal con info del producto → "Ver detalle completo" navega a `/productos/{id}`
- [ ] En `/pedidos`: click en nombre de cliente → modal con info del cliente → "Ver detalle completo" navega a `/clientes/{id}`
- [ ] En `/productos`: click en nombre de categoria → modal con info de la categoria → "Ver detalle completo" navega a `/categorias/{id}`
- [ ] En `/pedidos/{id}` (items table): click en codigo de producto → modal con info del producto
- [ ] En `/pagos`: click en nombre de cliente → modal con info del cliente
- [ ] En todas las tablas: click en la fila (fuera del link) sigue navegando a la pagina de detalle de la fila (onRowClick funciona)
- [ ] El modal se cierra al hacer click fuera o en "Cerrar"
- [ ] El modal muestra loading spinner mientras carga
- [ ] Responsive: los modales se ven correctamente en movil

**Implementation Note**: Pausar aqui para confirmacion manual antes de Phase 3.

---

## Phase 3: Documentar el Patron en CLAUDE.md

### Overview
Agregar una seccion al CLAUDE.md que documente el patron de preview modals para que nuevos modulos lo implementen igual.

### Changes Required:

**File**: `CLAUDE.md`

Agregar una nueva seccion despues de la seccion 16 (Soft Delete):

```markdown
## 18. Preview Modal en Tablas (Entidades Relacionadas)

Cuando una tabla muestra datos de una entidad relacionada (ej: nombre de producto en inventario), esa columna debe ser **clickeable** y abrir un **modal de vista previa** con la informacion principal de la entidad.

### Componentes de preview existentes

Los preview modals viven en `src/features/<entidad>/components/<Entidad>PreviewModal.tsx`:
- `ProductPreviewModal` — para tablas que muestran productos
- `ClientPreviewModal` — para tablas que muestran clientes
- `CategoryPreviewModal` — para tablas que muestran categorias

### Patron del cell renderer

```tsx
// Columna clickeable con preview modal
{
  key: "relatedEntity",
  header: "Entidad",
  cell: (row) => (
    <button
      className="text-primary hover:underline text-left"
      onClick={(e) => {
        e.stopPropagation();
        setPreviewEntityId(row.relatedEntity.id);
      }}
    >
      {row.relatedEntity.name}
    </button>
  ),
}
```

### Reglas

1. **Estilo**: `className="text-primary hover:underline text-left"` (igual que los links existentes)
2. **Stop propagation**: SIEMPRE usar `e.stopPropagation()` para evitar que se dispare el `onRowClick` de la fila
3. **Usar `<button>`** no `<Link>` (el modal no navega)
4. **Estado en la tabla**: `const [previewEntityId, setPreviewEntityId] = useState<string | null>(null)`
5. **Interface TypeScript**: La interface de la fila DEBE incluir el `id` de la entidad relacionada
6. **Null guard**: Si la relacion es nullable, mostrar `"-"` en vez del boton

### Patron del preview modal

```tsx
interface EntityPreviewModalProps {
  entityId: string | null;  // null = cerrado
  onClose: () => void;
}
```

Cada preview modal:
- Hace fetch via server action existente (`getEntity(id)`) cuando se abre
- Muestra `Loader2` spinner durante la carga
- Usa key-value rows: `<div className="flex justify-between">` dentro de `space-y-3 text-sm`
- Footer con `DialogFooter`: boton "Cerrar" + boton "Ver detalle completo" (`<Link>`)
- Tamanio: `sm:max-w-md`

### Cuando agregar un nuevo preview modal

Si creas un nuevo modulo con una tabla que muestra datos de otra entidad:
1. Verifica si ya existe un preview modal para esa entidad
2. Si no existe, crea uno en `src/features/<entidad>/components/<Entidad>PreviewModal.tsx`
3. Sigue el mismo patron interno (fetch on open, loading state, key-value rows, DialogFooter)
4. Importa y usa el modal en la tabla

### Cuando NO usar preview modal

- Cuando la relacion NO tiene pagina de detalle propia
- Cuando la columna ya es un `<Link>` a la pagina completa (como pedido en pagos/gastos)
- En tablas inline de paginas de detalle (ya estan en contexto de detalle)
```

### Success Criteria:

#### Automated Verification:
- [x] CLAUDE.md se guarda correctamente
- [x] No hay conflictos de formato

#### Manual Verification:
- [ ] La seccion es clara y completa para guiar futuros desarrollos
- [ ] No contradice ninguna seccion existente del CLAUDE.md

---

## Testing Strategy

### Manual Testing Steps:
1. Navegar a `/inventario` → click en nombre de producto → verificar que abre modal con info correcta
2. Navegar a `/pedidos` → click en nombre de cliente → verificar modal
3. Navegar a `/productos` → click en nombre de categoria → verificar modal
4. Navegar a `/pedidos/{id}` → click en codigo de producto en items table → verificar modal
5. Navegar a `/pagos` → click en nombre de cliente → verificar modal
6. En cada tabla: verificar que click en la fila (fuera del boton) sigue navegando
7. En cada modal: verificar "Ver detalle completo" navega correctamente
8. En cada modal: verificar que se cierra al hacer click fuera, en X, o en "Cerrar"
9. Verificar en movil: modales se ven correctamente, botones stack verticalmente

## Performance Considerations

- Los server actions de detalle (`getProduct`, `getClient`, `getCategory`) hacen queries simples con `findFirst` + include
- No hay caching — cada apertura del modal hace un fetch fresco
- El fetch es rapido (<100ms) dado que son queries por `id` con index
- Si en el futuro se necesita caching, se puede agregar en los server actions sin cambiar los modales

## References

- Research document: `thoughts/shared/research/2026-03-02_21-28-50_[general]_patron-link-modal-relaciones-tablas.md`
- DataTable component: `src/components/shared/DataTable.tsx:12-73`
- Existing link-in-cell pattern: `src/app/(dashboard)/pagos/payments-table.tsx:82-89`
- Product detail page (reference layout): `src/app/(dashboard)/productos/[id]/page.tsx:36-98`
- Client detail page (reference layout): `src/app/(dashboard)/clientes/[id]/page.tsx:37-63`
- EntitySelectorModal (reference dialog): `src/components/shared/EntitySelectorModal.tsx:54-173`
