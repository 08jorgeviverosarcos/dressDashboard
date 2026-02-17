# COP Dress Dashboard

Sistema de gestión para negocio de vestidos de alquiler y venta. Administra pedidos, inventario, pagos, gastos, clientes y categorías de productos.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Estilos | Tailwind CSS 4 |
| Componentes UI | shadcn/ui (estilo New York) |
| Formularios | React Hook Form + Zod |
| Notificaciones | Sonner |
| Gráficas | Recharts |
| Iconos | Lucide React |

---

## Requisitos previos

- **Node.js** >= 18
- **Docker** (para levantar PostgreSQL local)
- **npm**

---

## Configuración inicial

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd dressDashboard
npm install
```

### 2. Variables de entorno

Copia el archivo de ejemplo y ajusta si es necesario:

```bash
cp .env.example .env
```

`.env.example`:
```env
DATABASE_URL="postgresql://cop:cop_secret@localhost:5432/dress_dashboard"
```

> Para producción (Neon u otro proveedor), reemplaza con la URL correspondiente.

### 3. Levantar la base de datos

```bash
docker-compose up -d
```

Esto levanta un contenedor PostgreSQL con las credenciales definidas en `.env`.

### 4. Aplicar migraciones y sembrar datos

```bash
npm run db:migrate   # Aplica migraciones
npm run db:seed      # Carga datos de prueba
```

### 5. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Linter (ESLint)

npm run db:migrate   # npx prisma migrate dev
npm run db:seed      # npx prisma db seed
npm run db:studio    # Abre Prisma Studio (GUI de la BD)
npm run db:reset     # Resetea la BD y re-corre migraciones y seed
```

---

## Estructura del proyecto

```
dressDashboard/
├── prisma/
│   ├── migrations/          # Historial de migraciones SQL (no editar manualmente)
│   ├── schema.prisma        # Fuente de verdad del schema de la BD
│   └── seed.ts              # Script de datos iniciales para desarrollo
│
├── src/
│   ├── app/                 # Rutas de Next.js (App Router)
│   │   ├── layout.tsx       # Layout raíz: sidebar + área principal
│   │   ├── page.tsx         # Dashboard principal (/)
│   │   ├── dashboard-charts.tsx  # Componente cliente para las gráficas del dashboard
│   │   │
│   │   ├── categorias/      # Módulo de categorías de productos
│   │   ├── clientes/        # Módulo de clientes
│   │   ├── gastos/          # Módulo de gastos
│   │   ├── inventario/      # Módulo de inventario
│   │   ├── pagos/           # Módulo de pagos
│   │   ├── pedidos/         # Módulo de pedidos (el más complejo)
│   │   └── productos/       # Módulo de productos
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx        # Navegación lateral (rutas, iconos, mobile)
│   │   ├── shared/                # Componentes reutilizables en toda la app
│   │   │   ├── ConfirmDialog.tsx  # Dialog de confirmación genérico
│   │   │   ├── CurrencyDisplay.tsx# Formato de moneda COP
│   │   │   ├── DataTable.tsx      # Tabla genérica con columnas configurables
│   │   │   ├── PageHeader.tsx     # Cabecera de página (título + botón de acción)
│   │   │   ├── SearchInput.tsx    # Input de búsqueda (sincroniza con URL params)
│   │   │   └── StatusBadge.tsx    # Badge de estado con colores por tipo
│   │   ├── orders/                # Componentes específicos del módulo pedidos
│   │   ├── expenses/              # Componentes específicos del módulo gastos
│   │   ├── inventory/             # Componentes específicos del módulo inventario
│   │   └── ui/                    # Componentes shadcn/ui (no editar directamente)
│   │
│   ├── lib/
│   │   ├── actions/         # Server Actions: toda la lógica de negocio y acceso a BD
│   │   │   ├── categories.ts
│   │   │   ├── clients.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── expenses.ts
│   │   │   ├── inventory.ts
│   │   │   ├── orders.ts
│   │   │   ├── payments.ts
│   │   │   ├── products.ts
│   │   │   └── rentals.ts
│   │   ├── business/        # Lógica de negocio pura (sin efectos secundarios)
│   │   │   ├── order-type.ts  # Detectar si un pedido es venta o alquiler
│   │   │   ├── profit.ts      # Cálculo de ganancias y pagos
│   │   │   └── status.ts      # Transiciones válidas de estado de pedido
│   │   ├── constants/
│   │   │   └── categories.ts  # Labels para enums (tipos, estados, métodos de pago)
│   │   ├── validations/     # Schemas Zod — uno por entidad
│   │   │   ├── category.ts
│   │   │   ├── client.ts
│   │   │   ├── expense.ts
│   │   │   ├── order.ts
│   │   │   ├── payment.ts
│   │   │   ├── product.ts
│   │   │   └── rental.ts
│   │   ├── prisma.ts        # Singleton del cliente Prisma
│   │   └── utils.ts         # Helpers: cn(), formatCurrency(), formatDate()
│   │
│   └── types/
│       └── index.ts         # Tipos TypeScript compartidos (Prisma payloads + ActionResult)
│
├── .env                     # Variables de entorno locales (no commitear)
├── .env.example             # Plantilla de variables de entorno
├── docker-compose.yml       # PostgreSQL local
├── prisma.config.ts         # Configuración de Prisma CLI
└── components.json          # Configuración de shadcn/ui
```

---

## Estructura de un módulo

Cada módulo sigue esta convención. Ejemplo con `/productos`:

```
src/app/productos/
├── page.tsx              # Server Component: fetch de datos + renderiza la tabla
├── products-table.tsx    # Client Component: tabla con filtros y navegación
├── product-form.tsx      # Client Component: formulario compartido (crear/editar)
├── nuevo/
│   └── page.tsx          # Server Component: carga dependencias → pasa al form
└── [id]/
    ├── page.tsx           # Server Component: detalle del registro
    └── editar/
        └── page.tsx       # Server Component: carga datos + dependencias → pasa al form
```

### Regla Server vs Client Component

| Archivo | Tipo | Por qué |
|---|---|---|
| `page.tsx` (lista) | Server | Fetch de datos con Prisma |
| `*-table.tsx` | Client | `useRouter`, `useSearchParams` |
| `*-form.tsx` | Client | `useForm`, estado, interacción |
| `page.tsx` (detalle/editar) | Server | Fetch de datos + relaciones |
| `page.tsx` (nuevo) | Server | Pre-carga dependencias (ej: categorías) |

---

## Server Actions

Todo acceso a la base de datos ocurre en `src/lib/actions/`. Cada archivo:

- Tiene la directiva `"use server"` al inicio
- Valida con Zod antes de tocar la BD
- Retorna `ActionResult<T>` (`{ success: true, data }` o `{ success: false, error }`)
- Llama a `revalidatePath()` después de mutaciones

```typescript
// Patrón estándar de una action de mutación
export async function createSomething(data: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await prisma.something.create({ data: parsed.data });
  revalidatePath("/something");
  return { success: true, data: { id: result.id } };
}
```

### Actions por módulo

| Archivo | Funciones exportadas |
|---|---|
| `categories.ts` | `getCategories`, `getCategory`, `createCategory`, `updateCategory`, `deleteCategory` |
| `clients.ts` | `getClients`, `getClient`, `createClient`, `updateClient`, `deleteClient` |
| `dashboard.ts` | `getDashboardData`, `getMonthlyTrends`, `getTopProducts` |
| `expenses.ts` | `getExpenses`, `getExpense`, `createExpense`, `updateExpense`, `deleteExpense` |
| `inventory.ts` | `getInventoryItems`, `createInventoryItem`, `updateInventoryStatus`, `updateInventoryItem`, `deleteInventoryItem` |
| `orders.ts` | `getOrders`, `getOrder`, `createOrder`, `updateOrder`, `updateOrderStatus` |
| `payments.ts` | `getPayments`, `createPayment`, `deletePayment` |
| `products.ts` | `getProducts`, `getProduct`, `createProduct`, `updateProduct` |
| `rentals.ts` | `getRental`, `createRental`, `updateRental`, `addRentalCost`, `deleteRentalCost` |

---

## Validaciones (Zod)

Cada entidad tiene su schema en `src/lib/validations/`. El schema es la fuente de verdad para:

- Tipos de formulario (`z.infer<typeof schema>`)
- Validación en el server action
- Validación en el cliente vía `zodResolver`

```typescript
// Nunca dupliques la validación — el mismo schema se usa en cliente y servidor
const form = useForm<MyFormData>({
  resolver: zodResolver(mySchema),  // cliente
});

// servidor
const parsed = mySchema.safeParse(data);
```

---

## Base de datos

### Modelos principales

| Modelo | Descripción |
|---|---|
| `Client` | Clientes del negocio |
| `Category` | Categorías de productos (nombre + código) |
| `Product` | Vestidos, accesorios y servicios del catálogo |
| `InventoryItem` | Unidades físicas de cada producto |
| `Order` | Pedidos de venta o alquiler |
| `OrderItem` | Líneas de un pedido |
| `Payment` | Pagos registrados contra un pedido |
| `Expense` | Gastos del negocio |
| `Rental` | Detalle de alquiler vinculado a un pedido |
| `RentalCost` | Costos adicionales de un alquiler |
| `AuditLog` | Registro de cambios en pedidos y pagos |

### Flujo de estados de pedido

```
QUOTE → CONFIRMED → IN_PROGRESS → READY → DELIVERED → COMPLETED
  ↓          ↓            ↓          ↓         ↓
CANCELLED  CANCELLED   CANCELLED  CANCELLED CANCELLED
```

Los pagos pueden avanzar el estado automáticamente (ver `src/lib/business/status.ts`).

### Comandos de Prisma

```bash
# Crear y aplicar una nueva migración tras cambiar schema.prisma
npm run db:migrate

# Regenerar el cliente TypeScript después de cambiar schema.prisma
npx prisma generate

# Inspeccionar la BD visualmente
npm run db:studio

# Resetear la BD (borra todo y re-corre seed)
npm run db:reset
```

> **Importante:** después de modificar `prisma/schema.prisma`, siempre correr `npx prisma generate` para que TypeScript reconozca los cambios. Si el editor muestra errores de tipos pero `tsc` no los muestra, reiniciar el servidor TS del editor (`TypeScript: Restart TS Server`).

### Relaciones con Prisma

Para campos de relación en `create`/`update`, usar la sintaxis `connect`/`disconnect` en vez de IDs directos:

```typescript
// Correcto
category: categoryId ? { connect: { id: categoryId } } : undefined

// Incorrecto (causa error de tipos)
categoryId: categoryId ?? null
```

---

## Componentes compartidos

### `DataTable`

Tabla genérica. Definir columnas con tipado:

```typescript
const columns: Column<MyType>[] = [
  {
    key: "name",
    header: "Nombre",
    cell: (row) => row.name,
  },
];

<DataTable columns={columns} data={items} onRowClick={(row) => router.push(`/${row.id}`)} />
```

### `PageHeader`

```typescript
<PageHeader
  title="Módulo"
  description="Descripción opcional"
  actionLabel="Nuevo registro"
  actionHref="/modulo/nuevo"
/>
```

### `ConfirmDialog`

```typescript
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Eliminar elemento"
  description="Esta acción no se puede deshacer."
  confirmLabel="Eliminar"
  variant="destructive"
  onConfirm={handleDelete}
  loading={isDeleting}
/>
```

### `ActionResult`

Tipo de retorno estándar para todas las server actions:

```typescript
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Uso en componente cliente
const result = await createSomething(data);
if (result.success) {
  toast.success("Creado");
} else {
  toast.error(result.error);
}
```

---

## Agregar un nuevo módulo

Sigue estos pasos para agregar un módulo completo (ejemplo: `/proveedores`):

1. **Schema** — Agregar modelo en `prisma/schema.prisma` y correr `npm run db:migrate`

2. **Validación** — Crear `src/lib/validations/proveedor.ts` con el schema Zod

3. **Actions** — Crear `src/lib/actions/proveedores.ts` con las funciones CRUD

4. **Páginas**:
   - `src/app/proveedores/page.tsx` — lista (server component)
   - `src/app/proveedores/proveedores-table.tsx` — tabla (client component)
   - `src/app/proveedores/nuevo/page.tsx` — formulario crear
   - `src/app/proveedores/[id]/editar/page.tsx` — formulario editar

5. **Sidebar** — Agregar entrada en `src/components/layout/Sidebar.tsx`

---

## Convenciones

- **Idioma de la UI:** español
- **Formato de moneda:** COP, usando `formatCurrency()` de `src/lib/utils.ts`
- **Formato de fechas:** `dd/MM/yyyy` usando `formatDate()` de `src/lib/utils.ts`
- **Clases CSS:** siempre usar `cn()` para combinar clases de Tailwind
- **Imports:** usar alias `@/` (ej: `@/lib/actions/products`)
- **Componentes UI:** usar los de `src/components/ui/` (shadcn). Para agregar nuevos: `npx shadcn add <componente>`
- **No hay API routes** (`/api/*`): toda la comunicación cliente-servidor ocurre mediante Server Actions
