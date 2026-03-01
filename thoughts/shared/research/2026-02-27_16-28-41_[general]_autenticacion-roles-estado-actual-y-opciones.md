---
date: "2026-02-27T16:28:41-05:00"
researcher: Claude
git_commit: 1da1d5b913540a1fd6e6914016a020e85764d03f
branch: main
repository: dressDashboard
topic: "Autenticación con roles: estado actual del codebase y opciones de implementación"
tags: [research, authentication, authorization, roles, security, server-actions, prisma]
status: complete
last_updated: "2026-02-27"
last_updated_by: Claude
---

# Research: Autenticación con Roles — Estado Actual y Opciones

**Date**: 2026-02-27T16:28:41-05:00
**Researcher**: Claude
**Git Commit**: 1da1d5b
**Branch**: main
**Repository**: dressDashboard

## Research Question

Agregar autenticación con roles (admin y sales) usando email/password. Sin social sign-in, sin verificación de email. El admin puede agregar otros usuarios.

## Summary

El codebase actualmente **no tiene ningún tipo de autenticación, autorización ni gestión de usuarios**. No existe modelo User en Prisma, no hay middleware.ts, no hay páginas de login, y todas las rutas son públicamente accesibles. La investigación evaluó 4 opciones para implementar auth y la **opción recomendada es custom auth con `jose` + `bcryptjs` + httpOnly cookies**, que es el patrón oficialmente documentado por Next.js.

---

## Detailed Findings

### 1. Estado Actual: Sin Autenticación

**No existe ninguna infraestructura de autenticación en el codebase:**

- **No hay `middleware.ts`** ni en la raíz ni en `src/`
- **No hay modelo `User`** en `prisma/schema.prisma` — los 11 modelos existentes son: Client, Category, Product, InventoryItem, Order, OrderItem, Payment, Expense, Rental, RentalCost, AuditLog
- **No hay dependencias de auth** en `package.json` — sin next-auth, bcrypt, jose, iron-session, lucia
- **No hay variables de entorno** de auth — sin AUTH_SECRET, JWT_SECRET, SESSION_SECRET
- **No hay página de login** — no existe `/login`, `/signin`, ni `/auth/*`
- **No hay route groups** protegidos — no existe `(auth)`, `(protected)`, `(public)`
- **No hay checks de sesión** en ningún server action ni componente

Las 28 rutas de la app son completamente abiertas:
```
/                           /pedidos           /clientes
/pedidos/nuevo              /clientes/nuevo    /productos
/pedidos/[id]               /clientes/[id]     /productos/nuevo
/pedidos/[id]/editar        /clientes/[id]/editar  /productos/[id]
/pedidos/[id]/items/[itemId]                   /productos/[id]/editar
/pedidos/[id]/items/[itemId]/editar            /categorias
/categorias/nuevo           /categorias/[id]   /categorias/[id]/editar
/inventario                 /inventario/nuevo  /inventario/[id]
/pagos                      /pagos/[id]
/gastos                     /gastos/nuevo      /gastos/[id]
/gastos/[id]/editar
```

### 2. Estructura de Layout y Navegación

**Un solo layout raíz** (`src/app/layout.tsx`) sin layouts anidados. Renderiza:
1. `<Sidebar />` — importado de `@/components/layout/Sidebar`
2. `<main>` — con `md:ml-64 min-h-screen`
3. `<Toaster />` — notificaciones con Sonner

**Sidebar** (`src/components/layout/Sidebar.tsx`): componente client con 8 items de navegación:

| Ruta | Label | Icono |
|------|-------|-------|
| `/` | Panel | LayoutDashboard |
| `/pedidos` | Pedidos | ShoppingBag |
| `/clientes` | Clientes | Users |
| `/productos` | Productos | Package |
| `/categorias` | Categorias | Tag |
| `/inventario` | Inventario | Boxes |
| `/pagos` | Pagos | CreditCard |
| `/gastos` | Gastos | Receipt |

Sin ningún filtrado por roles ni rendering condicional basado en usuario.

### 3. Patrón de Server Actions (para integrar auth)

Todas las actions en `src/lib/actions/` siguen este patrón:

```typescript
"use server";
import { schema, type FormData } from "@/lib/validations/feature";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/feature/feature.service";

// Read (sin validación, pass-through)
export async function getEntities(filters?) {
  return service.getEntities(filters);
}

// Mutation (validate → delegate → revalidate)
export async function createEntity(data: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const result = await service.createEntity(parsed.data);
  if (result.success) revalidatePath("/entities");
  return result;
}
```

**ActionResult** (`src/types/index.ts:32-34`):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### 4. Schema Prisma Existente

11 modelos, todos con soft delete excepto AuditLog. IDs con `cuid()`. Campos monetarios con `Decimal(12, 2)`. Relaciones documentadas completamente en la sección de findings del agente de Prisma.

**No existe modelo User, Role, Session, Account ni Token.**

---

## Opciones de Implementación Evaluadas

### Opción 1: Auth.js v5 (NextAuth) con Credentials Provider

- **Estado**: Activo, pero v5 en beta/RC largo tiempo
- **Problema crítico**: Credentials provider solo funciona con JWT sessions (no database sessions). No se pueden revocar sesiones server-side
- **Requiere API routes**: Necesita `/api/auth/[...nextauth]` — **viola la regla de arquitectura de no API routes**
- **Roles**: Via callbacks `jwt` y `session` (verboso)
- **Overkill**: La mayoría del library es para OAuth que no se necesita

### Opción 2: Lucia Auth

- **Estado**: **DEPRECADO desde 2025**
- **No usar para proyectos nuevos**
- Ahora es solo un recurso educativo en https://lucia-auth.com
- El enfoque que Lucia recomienda ahora es esencialmente la Opción 3

### Opción 3: Custom Auth con jose + bcryptjs + httpOnly Cookies ✅ RECOMENDADA

- **Patrón oficialmente documentado por Next.js**: https://nextjs.org/docs/app/guides/authentication
- **No requiere API routes** — todo vía Server Actions
- **Roles directo en JWT payload** — sin callbacks ni config extra
- **Solo 2 dependencias nuevas**: `jose` y `bcryptjs`
- **~150 líneas de código auth total**
- **Compatible con Edge Runtime** (jose funciona en Edge)
- **Encaja perfecto con la arquitectura layered** del proyecto

Estructura mínima:
```
src/lib/session.ts     — encrypt, decrypt, createSession, deleteSession
src/lib/dal.ts         — verifySession (cached con React.cache)
src/lib/actions/auth.ts — login, logout server actions
proxy.ts               — protección de rutas (Next.js 16)
```

### Opción 4: Better Auth

- Requiere API route (`/api/auth/[...all]`) — **viola la regla de arquitectura**
- Descartada por la misma razón que Auth.js

---

## Comparación

| Criterio | Auth.js v5 | Lucia | Custom (jose+bcrypt) | Better Auth |
|---|---|---|---|---|
| Mantenido | Sí | **No** | N/A (tu código) | Sí |
| Credentials first-class | **No** | N/A | **Sí** | Sí |
| Roles | Via callbacks | N/A | **Directo en JWT** | Sí |
| Server Actions | Bueno | N/A | **Perfecto** | Bueno |
| Requiere API routes | **Sí** ❌ | N/A | **No** ✅ | **Sí** ❌ |
| Complejidad | Overkill | N/A | **Mínima** | Media |
| Docs oficiales Next.js | Referenciado | N/A | **Patrón principal** | No |

---

## Implementación Recomendada (Opción 3)

### Modelo Prisma necesario

```prisma
enum UserRole {
  ADMIN
  SALES
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  role         UserRole  @default(SALES)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  @@index([deletedAt])
}
```

### Archivos nuevos necesarios

| Archivo | Responsabilidad |
|---------|----------------|
| `src/lib/session.ts` | Encrypt/decrypt JWT con jose, crear/eliminar cookie httpOnly |
| `src/lib/dal.ts` | `verifySession()` cacheado con `React.cache`, redirect a /login si no auth |
| `src/lib/validations/auth.ts` | Zod schemas para login |
| `src/lib/actions/auth.ts` | Server actions: `login()`, `logout()`, `createUser()` |
| `src/features/users/users.service.ts` | Lógica de negocio: validar credenciales, crear usuario |
| `src/features/users/users.repo.ts` | Queries Prisma para User |
| `src/features/users/users.strings.ts` | Strings de UI |
| `src/app/login/page.tsx` | Página de login |
| `src/app/usuarios/page.tsx` | Página admin para gestionar usuarios |
| `proxy.ts` (o `middleware.ts`) | Protección de rutas a nivel de request |

### Seguridad incluida

- Password hashing con bcryptjs (10-12 rounds)
- JWT con HS256 via jose (Edge-compatible)
- Cookie httpOnly + secure + sameSite=lax
- CSRF protection ya incluida por Next.js en Server Actions
- Roles en JWT payload para checks rápidos
- `server-only` import para prevenir leaks al client

### Restricciones de roles

| Acción | Admin | Sales |
|--------|-------|-------|
| Ver dashboard, pedidos, clientes, productos, etc. | ✅ | ✅ |
| CRUD de entidades de negocio | ✅ | ✅ |
| Crear/gestionar usuarios | ✅ | ❌ |
| Ver página `/usuarios` | ✅ | ❌ |

---

## Code References

- `src/app/layout.tsx` — Root layout, donde se integraría el auth provider
- `src/components/layout/Sidebar.tsx` — Navegación, necesitará filtrado por rol
- `src/lib/actions/*.ts` — Server actions existentes, patrón a seguir para auth actions
- `src/types/index.ts:32-34` — ActionResult type
- `src/lib/prisma.ts` — Prisma client con soft-delete extension
- `prisma/schema.prisma` — Schema donde se agregará modelo User

## Architecture Insights

- La arquitectura layered (Actions → Services → Repos) se mantiene perfectamente con custom auth
- `session.ts` y `dal.ts` encajan en `src/lib/` como utilidades de infraestructura
- Las actions de auth seguirían el mismo patrón de las existentes
- El modelo User seguiría las mismas convenciones (cuid, soft delete, timestamps)
- El Sidebar necesitará recibir el rol del usuario para filtrar items de navegación

## Historical Context (from thoughts/)

No existen documentos previos sobre autenticación en el directorio `thoughts/`.

## Related Research

- `thoughts/shared/research/2026-02-25_13-39-25_[general]_pedidos-estado-automatizaciones-current-state.md`
- `thoughts/shared/research/2026-02-26_11-52-31_[general]_inventario-cantidad-estado-automatizacion.md`

## External References

- [Next.js Authentication Guide (Official)](https://nextjs.org/docs/app/guides/authentication)
- [jose Library (GitHub)](https://github.com/panva/jose)
- [The Copenhagen Book (Security Reference)](https://thecopenhagenbook.com/)
- [Auth.js v5 Docs](https://authjs.dev/reference/nextjs)
- [Lucia Auth Deprecation](https://github.com/lucia-auth/lucia/discussions/1714)

## Open Questions

1. **¿Se necesita seed de usuario admin inicial?** — El primer usuario admin debe crearse via seed de Prisma o un comando CLI, ya que no habrá forma de crear usuarios sin estar logueado como admin.
2. **¿Expiración de sesión?** — El estándar es 7 días con refresh automático. ¿Se requiere diferente?
3. **¿Se necesita logging de auth en AuditLog?** — Login/logout/creación de usuario podrían registrarse en el audit trail.
4. **¿El rol "sales" necesita restricciones adicionales?** — Actualmente la diferencia es solo que no puede gestionar usuarios. ¿Se necesitan más restricciones en el futuro?
