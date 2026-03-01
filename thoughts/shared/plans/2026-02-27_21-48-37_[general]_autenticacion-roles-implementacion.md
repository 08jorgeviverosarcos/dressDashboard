# Autenticación con Roles — Implementation Plan

## Overview

Implementar autenticación email/password con dos roles (ADMIN, SALES) usando custom auth con `jose` + `bcryptjs` + httpOnly cookies. Patrón oficial de Next.js 16. Sin social sign-in, sin verificación de email. El admin puede gestionar usuarios; sales accede a todo excepto la gestión de usuarios.

## Current State Analysis

- **No existe autenticación** en el codebase — sin modelo User, sin middleware/proxy, sin login page
- **28 rutas** completamente abiertas sin protección
- **Patrón existente** bien definido: Actions (Zod + revalidate) → Services (business logic) → Repos (Prisma)
- **Sidebar** con 8 items de navegación sin filtrado por rol
- **Next.js 16.1.6** — usa `proxy.ts` en lugar de `middleware.ts`

### Key Discoveries:
- `src/lib/prisma.ts` — Prisma client con soft-delete extension, debe agregar "User" al set `SOFT_DELETE_MODELS`
- `src/types/index.ts` — ActionResult type en línea 32-34
- `src/components/layout/Sidebar.tsx` — Client component con navItems estáticos
- `prisma/seed.ts` — Seed existente usa PrismaClient raw, se agregará seed de admin
- No existen archivos `*.strings.ts` en ningún feature (strings hardcoded en services)

## Desired End State

1. Login page funcional en `/login`
2. Todas las rutas protegidas — redirect a `/login` si no autenticado
3. Usuarios logueados ven el dashboard normal
4. Admin ve item "Usuarios" en sidebar y puede acceder a `/usuarios`
5. Sales NO ve "Usuarios" en sidebar y es redirigido si intenta acceder a `/usuarios`
6. Admin puede crear, ver y eliminar usuarios
7. Eventos de auth registrados en AuditLog
8. Seed crea admin inicial: admin@cop.com / admin123
9. Sesión JWT de 7 días con refresh automático

### Verificación:
- Login con credenciales correctas → redirect al dashboard
- Login con credenciales incorrectas → error message
- Acceder a cualquier ruta sin sesión → redirect a /login
- Admin: puede acceder a /usuarios y crear usuarios
- Sales: no ve "Usuarios" en sidebar, redirect si navega a /usuarios
- Logout → cookie eliminada, redirect a /login

## What We're NOT Doing

- Social sign-in (Google, GitHub, etc.)
- Verificación de email
- Recuperación de contraseña
- Múltiples sesiones activas por usuario
- Revocación server-side de sesiones (stateless JWT)
- Rate limiting en login (se puede agregar después)
- Two-factor authentication (2FA)

## Implementation Approach

Implementación en 6 fases incrementales. Cada fase es testeable independientemente. Seguimos el patrón exacto del codebase existente (categories feature como referencia).

---

## Phase 1: Database + Dependencies

### Overview
Agregar modelo User a Prisma, instalar dependencias, crear migración, seed del admin inicial.

### Changes Required:

#### 1. Instalar dependencias
```bash
npm install jose bcryptjs server-only
npm install -D @types/bcryptjs
```

#### 2. Prisma Schema — Agregar enum y modelo User
**File**: `prisma/schema.prisma`
**Changes**: Agregar al final del archivo (antes de los enums existentes o después del último modelo)

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
  @@index([email])
}
```

#### 3. Prisma Client — Agregar "User" al soft-delete set
**File**: `src/lib/prisma.ts`
**Changes**: Agregar `"User"` al set `SOFT_DELETE_MODELS`

```typescript
const SOFT_DELETE_MODELS = new Set([
  "Client",
  "Category",
  "Product",
  "InventoryItem",
  "Order",
  "OrderItem",
  "Payment",
  "Expense",
  "Rental",
  "RentalCost",
  "User",  // ← agregar
]);
```

#### 4. Seed — Agregar admin inicial
**File**: `prisma/seed.ts`
**Changes**: Agregar al inicio del seed (después de los deletes, antes de los creates). Importar bcryptjs.

```typescript
import bcrypt from "bcryptjs";

// Inside the seed function, after deleteMany calls:
await prisma.user.deleteMany();

const adminPasswordHash = await bcrypt.hash("admin123", 12);
await prisma.user.create({
  data: {
    email: "admin@cop.com",
    passwordHash: adminPasswordHash,
    name: "Administrador",
    role: "ADMIN",
  },
});
```

#### 5. Generar migración
```bash
npx prisma migrate dev --name add-user-model
```

### Success Criteria:

#### Automated Verification:
- [ ] Migración aplica correctamente: `npx prisma migrate dev`
- [ ] Seed corre sin errores: `npx prisma db seed`
- [ ] TypeCheck pasa: `npm run typecheck`
- [ ] Prisma Studio muestra tabla User con admin: `npx prisma studio`

#### Manual Verification:
- [ ] En Prisma Studio, verificar que el usuario admin existe con role ADMIN
- [ ] Verificar que el passwordHash NO es texto plano

**Pausa aquí para confirmación manual.**

---

## Phase 2: Auth Infrastructure (session.ts + dal.ts)

### Overview
Crear la infraestructura de sesión: encrypt/decrypt JWT, crear/eliminar cookie, y Data Access Layer para verificación.

### Changes Required:

#### 1. Variable de entorno
**File**: `.env`
**Changes**: Agregar

```
SESSION_SECRET=your-secret-key-at-least-32-characters-long
```

> Generar con: `openssl rand -base64 32`

#### 2. Session utilities
**File**: `src/lib/session.ts` (NUEVO)

```typescript
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type SessionPayload = {
  userId: string;
  role: "ADMIN" | "SALES";
  expiresAt: Date;
};

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_THRESHOLD_MS = 1 * 24 * 60 * 60 * 1000; // 1 day

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, expiresAt: payload.expiresAt.toISOString() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .sign(encodedKey);
}

export async function decrypt(
  session: string | undefined
): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return {
      userId: payload.userId as string,
      role: payload.role as "ADMIN" | "SALES",
      expiresAt: new Date(payload.expiresAt as string),
    };
  } catch {
    return null;
  }
}

export async function createSession(userId: string, role: "ADMIN" | "SALES") {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({ userId, role, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function refreshSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session) return;

  const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
  if (timeUntilExpiry < REFRESH_THRESHOLD_MS) {
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const newSession = await encrypt({
      userId: session.userId,
      role: session.role,
      expiresAt: newExpiresAt,
    });
    cookieStore.set("session", newSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: newExpiresAt,
      sameSite: "lax",
      path: "/",
    });
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
```

#### 3. Data Access Layer
**File**: `src/lib/dal.ts` (NUEVO)

```typescript
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt, type SessionPayload } from "./session";

export const verifySession = cache(async (): Promise<{
  userId: string;
  role: "ADMIN" | "SALES";
}> => {
  const cookieStore = await cookies();
  const session = await decrypt(cookieStore.get("session")?.value);

  if (!session?.userId) {
    redirect("/login");
  }

  return { userId: session.userId, role: session.role };
});

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get("session")?.value);
});
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeCheck pasa: `npm run typecheck`
- [ ] No errores de lint: `npm run lint`

#### Manual Verification:
- [ ] N/A — estos módulos se testean en la fase siguiente

**Pausa aquí para confirmación manual.**

---

## Phase 3: Auth Feature (Repo + Service + Actions + Validation)

### Overview
Crear la feature de autenticación siguiendo el patrón layered existente: repo → service → actions.

### Changes Required:

#### 1. Validation Schema
**File**: `src/lib/validations/auth.ts` (NUEVO)

```typescript
import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.string().min(1, "El email es requerido").email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  email: z.string().min(1, "El email es requerido").email("Email inválido"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().min(1, "El nombre es requerido"),
  role: z.enum(["ADMIN", "SALES"]),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
```

#### 2. Repository
**File**: `src/features/users/users.repo.ts` (NUEVO)

```typescript
import { prisma } from "@/lib/prisma";

export async function findByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email },
  });
}

export async function findById(id: string) {
  return prisma.user.findFirst({
    where: { id },
  });
}

export async function findAll() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function create(data: {
  email: string;
  passwordHash: string;
  name: string;
  role: "ADMIN" | "SALES";
}) {
  return prisma.user.create({
    data,
  });
}

export async function deleteById(id: string) {
  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

#### 3. Service
**File**: `src/features/users/users.service.ts` (NUEVO)

```typescript
import type { ActionResult } from "@/types";
import * as repo from "./users.repo";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function validateCredentials(
  email: string,
  password: string
): Promise<
  ActionResult<{ id: string; role: "ADMIN" | "SALES"; name: string }>
> {
  const user = await repo.findByEmail(email);

  if (!user) {
    return { success: false, error: "Credenciales inválidas" };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return { success: false, error: "Credenciales inválidas" };
  }

  return {
    success: true,
    data: { id: user.id, role: user.role, name: user.name },
  };
}

export async function getUsers() {
  return repo.findAll();
}

export async function getUser(id: string) {
  return repo.findById(id);
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "SALES";
}): Promise<ActionResult<{ id: string }>> {
  const existing = await repo.findByEmail(data.email);
  if (existing) {
    return { success: false, error: "Ya existe un usuario con ese email" };
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await repo.create({
    email: data.email,
    passwordHash,
    name: data.name,
    role: data.role,
  });

  return { success: true, data: { id: user.id } };
}

export async function deleteUser(
  id: string,
  currentUserId: string
): Promise<ActionResult> {
  if (id === currentUserId) {
    return { success: false, error: "No puedes eliminar tu propio usuario" };
  }

  const user = await repo.findById(id);
  if (!user) {
    return { success: false, error: "Usuario no encontrado" };
  }

  await repo.deleteById(id);
  return { success: true, data: undefined };
}
```

#### 4. Server Actions
**File**: `src/lib/actions/auth.ts` (NUEVO)

```typescript
"use server";

import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import {
  createUserSchema,
  type CreateUserFormData,
} from "@/lib/validations/auth";
import type { ActionResult } from "@/types";
import * as service from "@/features/users/users.service";
import { createSession, deleteSession } from "@/lib/session";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function login(
  data: LoginFormData
): Promise<ActionResult<{ name: string }>> {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.validateCredentials(
    parsed.data.email,
    parsed.data.password
  );

  if (!result.success) {
    return result;
  }

  await createSession(result.data.id, result.data.role);
  return { success: true, data: { name: result.data.name } };
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function getUsers() {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return [];
  }
  return service.getUsers();
}

export async function createUser(
  data: CreateUserFormData
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createUser(parsed.data);
  if (result.success) revalidatePath("/usuarios");
  return result;
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const result = await service.deleteUser(id, session.userId);
  if (result.success) revalidatePath("/usuarios");
  return result;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeCheck pasa: `npm run typecheck`
- [ ] No errores de lint: `npm run lint`

#### Manual Verification:
- [ ] N/A — se testea con la UI en la fase siguiente

**Pausa aquí para confirmación manual.**

---

## Phase 4: Login Page + Logout

### Overview
Crear la página de login y el botón de logout en el sidebar.

### Changes Required:

#### 1. Login Page
**File**: `src/app/login/page.tsx` (NUEVO)

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { login } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginFormData) {
    const result = await login(data);
    if (result.success) {
      toast.success(`Bienvenido, ${result.data.name}`);
      router.push("/");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">COP Dress</CardTitle>
          <CardDescription>Inicia sesión para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="correo@ejemplo.com"
                        className="text-base md:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="text-base md:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 2. Login Layout (sin sidebar)
**File**: `src/app/login/layout.tsx` (NUEVO)

```tsx
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

> **Nota**: El root layout renderiza `<Sidebar />` incondicionalmente. Para que la página de login NO muestre sidebar, necesitamos reorganizar el layout. La solución es usar route groups.

#### 3. Reorganizar layouts con route groups

Mover las rutas actuales a un route group `(dashboard)` y crear un route group `(auth)` para login:

**Cambios en la estructura de archivos:**

```
src/app/
├── layout.tsx              ← Root layout (solo html/body, fonts, Toaster)
├── (auth)/
│   └── login/
│       └── page.tsx        ← Login page
├── (dashboard)/
│   ├── layout.tsx          ← Dashboard layout (Sidebar + main con padding)
│   ├── page.tsx            ← Panel (dashboard home)
│   ├── pedidos/...
│   ├── clientes/...
│   ├── productos/...
│   ├── categorias/...
│   ├── inventario/...
│   ├── pagos/...
│   ├── gastos/...
│   └── usuarios/...        ← Nuevo (Phase 6)
```

**Root layout modificado** (`src/app/layout.tsx`):

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "COP Dress Dashboard",
  description: "Sistema de gestión para alta costura COP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

**Dashboard layout** (`src/app/(dashboard)/layout.tsx` — NUEVO):

```tsx
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <main className="md:ml-64 min-h-screen">
        <div className="container mx-auto p-6 pt-16 md:pt-6">{children}</div>
      </main>
    </>
  );
}
```

**Mover todas las páginas existentes** de `src/app/` a `src/app/(dashboard)/`:
- `src/app/page.tsx` → `src/app/(dashboard)/page.tsx`
- `src/app/pedidos/` → `src/app/(dashboard)/pedidos/`
- `src/app/clientes/` → `src/app/(dashboard)/clientes/`
- `src/app/productos/` → `src/app/(dashboard)/productos/`
- `src/app/categorias/` → `src/app/(dashboard)/categorias/`
- `src/app/inventario/` → `src/app/(dashboard)/inventario/`
- `src/app/pagos/` → `src/app/(dashboard)/pagos/`
- `src/app/gastos/` → `src/app/(dashboard)/gastos/`

> **IMPORTANTE**: Las URLs NO cambian. Route groups `(dashboard)` y `(auth)` no afectan la URL. `/pedidos` sigue siendo `/pedidos`.

#### 4. Sidebar — Agregar botón de logout
**File**: `src/components/layout/Sidebar.tsx`
**Changes**: Agregar botón de logout al final del nav. Importar `logout` action.

Agregar al final del `navContent`, después del `.map()` de navItems:

```tsx
import { logout } from "@/lib/actions/auth";
import { LogOut } from "lucide-react"; // agregar al import de lucide

// Dentro de navContent, después del map de navItems:
<div className="mt-auto p-4 border-t">
  <form action={logout}>
    <button
      type="submit"
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <LogOut className="h-4 w-4" />
      Cerrar Sesión
    </button>
  </form>
</div>
```

El nav + logout deben estar envueltos para que `mt-auto` funcione:

```tsx
const navContent = (
  <div className="flex h-full flex-col">
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-6 px-3">
        <h1 className="text-xl font-bold">COP Dress</h1>
        <p className="text-xs text-muted-foreground">Dashboard</p>
      </div>
      {navItems.map((item) => {
        // ... existing code
      })}
    </nav>
    <div className="mt-auto p-4 border-t">
      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </button>
      </form>
    </div>
  </div>
);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeCheck pasa: `npm run typecheck`
- [ ] No errores de lint: `npm run lint`
- [ ] Build pasa: `npm run build`

#### Manual Verification:
- [ ] `/login` muestra formulario sin sidebar
- [ ] Login con admin@cop.com / admin123 → redirect a `/` con toast de bienvenida
- [ ] Login con credenciales incorrectas → toast de error "Credenciales inválidas"
- [ ] Todas las rutas existentes siguen funcionando (URLs no cambiaron)
- [ ] Botón "Cerrar Sesión" en sidebar → redirect a /login
- [ ] Inputs del login no causan zoom en iOS (text-base)

**Pausa aquí para confirmación manual.**

---

## Phase 5: Route Protection (proxy.ts)

### Overview
Proteger todas las rutas con `proxy.ts` (Next.js 16). Redirect a /login si no autenticado. Redirect authenticated users away from /login.

### Changes Required:

#### 1. Proxy file
**File**: `proxy.ts` (NUEVO, en la raíz del proyecto)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

const publicRoutes = ["/login"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const sessionCookie = request.cookies.get("session")?.value;
  const session = await decrypt(sessionCookie);
  const isAuthenticated = !!session?.userId;

  // Redirect unauthenticated users to login
  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // Redirect authenticated users away from login
  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  // Protect /usuarios for admin only
  if (path.startsWith("/usuarios") && session?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
```

> **Nota**: `proxy.ts` usa `request.cookies` (NextRequest API), no `await cookies()` de next/headers. `decrypt` de `session.ts` importa `server-only`, pero proxy.ts corre en Node.js en Next.js 16, así que funciona. Si hay problemas con el import de `server-only`, se extraerá decrypt a un módulo separado sin esa directiva.

#### 2. Actualizar session.ts para compatibilidad con proxy

Si `server-only` causa problemas en proxy.ts, separar encrypt/decrypt en un módulo sin `server-only`:

**File**: `src/lib/session.ts`
**Posible cambio**: Mover `encrypt`/`decrypt` a un archivo separado `src/lib/session-crypto.ts` sin `import "server-only"`, y re-exportar desde `session.ts`. Solo hacer esto si es necesario.

### Success Criteria:

#### Automated Verification:
- [ ] TypeCheck pasa: `npm run typecheck`
- [ ] Build pasa: `npm run build`

#### Manual Verification:
- [ ] Sin sesión: acceder a `/` → redirect a `/login`
- [ ] Sin sesión: acceder a `/pedidos` → redirect a `/login`
- [ ] Con sesión: acceder a `/login` → redirect a `/`
- [ ] Con sesión (sales): acceder a `/usuarios` → redirect a `/`
- [ ] Con sesión (admin): acceder a `/usuarios` → no redirect (page puede 404 por ahora, se crea en Phase 6)
- [ ] Refresh de página mantiene sesión activa

**Pausa aquí para confirmación manual.**

---

## Phase 6: User Management (Admin Only)

### Overview
Crear la página `/usuarios` donde el admin puede ver, crear y eliminar usuarios. El sidebar muestra "Usuarios" solo para admin.

### Changes Required:

#### 1. Sidebar — Agregar item condicional por rol
**File**: `src/components/layout/Sidebar.tsx`
**Changes**: Recibir el rol del usuario y filtrar navItems.

El Sidebar es un client component. Para pasar el rol, se puede:
- Opción A: Leer la session cookie client-side (NO recomendado, no es httpOnly)
- Opción B: Pasar el rol como prop desde el dashboard layout (server component)

**Opción B** es la correcta:

**Dashboard layout** (`src/app/(dashboard)/layout.tsx`) — modificar para pasar rol:

```tsx
import { Sidebar } from "@/components/layout/Sidebar";
import { verifySession } from "@/lib/dal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  return (
    <>
      <Sidebar userRole={session.role} />
      <main className="md:ml-64 min-h-screen">
        <div className="container mx-auto p-6 pt-16 md:pt-6">{children}</div>
      </main>
    </>
  );
}
```

**Sidebar** — agregar prop `userRole` y item condicional:

```tsx
// Agregar al import
import { UserCog } from "lucide-react"; // para el icono de usuarios

// Props type
type SidebarProps = {
  userRole: "ADMIN" | "SALES";
};

export function Sidebar({ userRole }: SidebarProps) {
  // ... existing code

  const navItems = [
    { href: "/", label: "Panel", icon: LayoutDashboard },
    { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/productos", label: "Productos", icon: Package },
    { href: "/categorias", label: "Categorías", icon: Tag },
    { href: "/inventario", label: "Inventario", icon: Boxes },
    { href: "/pagos", label: "Pagos", icon: CreditCard },
    { href: "/gastos", label: "Gastos", icon: Receipt },
    // Condicional: solo admin
    ...(userRole === "ADMIN"
      ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }]
      : []),
  ];

  // rest of component unchanged
}
```

#### 2. Usuarios List Page
**File**: `src/app/(dashboard)/usuarios/page.tsx` (NUEVO)

```tsx
import { getUsers } from "@/lib/actions/auth";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { UsersTable } from "./users-table";

export default async function UsuariosPage() {
  const session = await verifySession();
  if (session.role !== "ADMIN") redirect("/");

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios del sistema"
        actionLabel="Nuevo Usuario"
        actionHref="/usuarios/nuevo"
      />
      <UsersTable users={users} currentUserId={session.userId} />
    </div>
  );
}
```

#### 3. Users Table Component
**File**: `src/app/(dashboard)/usuarios/users-table.tsx` (NUEVO)

```tsx
"use client";

import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteUser } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type User = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "SALES";
  createdAt: Date;
};

type Props = {
  users: User[];
  currentUserId: string;
};

export function UsersTable({ users, currentUserId }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deletingId) return;
    const result = await deleteUser(deletingId);
    if (result.success) {
      toast.success("Usuario eliminado");
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  }

  const columns = [
    {
      key: "name" as const,
      header: "Nombre",
      cell: (user: User) => user.name,
    },
    {
      key: "email" as const,
      header: "Email",
      cell: (user: User) => user.email,
    },
    {
      key: "role" as const,
      header: "Rol",
      cell: (user: User) => (
        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
          {user.role === "ADMIN" ? "Admin" : "Ventas"}
        </Badge>
      ),
    },
    {
      key: "actions" as const,
      header: "",
      cell: (user: User) =>
        user.id !== currentUserId ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setDeletingId(user.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={users} />
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Eliminar usuario"
        description="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer."
      />
    </>
  );
}
```

#### 4. Create User Page
**File**: `src/app/(dashboard)/usuarios/nuevo/page.tsx` (NUEVO)

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  type CreateUserFormData,
} from "@/lib/validations/auth";
import { createUser } from "@/lib/actions/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { Loader2 } from "lucide-react";

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", password: "", name: "", role: "SALES" },
  });

  async function onSubmit(data: CreateUserFormData) {
    const result = await createUser(data);
    if (result.success) {
      toast.success("Usuario creado exitosamente");
      router.push("/usuarios");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Usuario" backHref="/usuarios" />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre completo"
                      className="text-base md:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      className="text-base md:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="text-base md:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="text-base md:text-sm">
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SALES">Ventas</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/usuarios")}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Usuario"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeCheck pasa: `npm run typecheck`
- [ ] No errores de lint: `npm run lint`
- [ ] Build pasa: `npm run build`

#### Manual Verification:
- [ ] Login como admin → sidebar muestra "Usuarios" con icono UserCog
- [ ] Login como sales → sidebar NO muestra "Usuarios"
- [ ] Admin: `/usuarios` muestra lista con admin inicial
- [ ] Admin: puede crear nuevo usuario (sales) desde `/usuarios/nuevo`
- [ ] Admin: puede eliminar usuarios (pero no a sí mismo)
- [ ] Sales: acceder a `/usuarios` redirige a `/`
- [ ] Nuevo usuario creado puede hacer login
- [ ] Responsive: formulario de crear usuario se adapta a mobile
- [ ] Responsive: tabla de usuarios funciona en mobile

**Pausa aquí para confirmación manual.**

---

## Phase 7: AuditLog Integration

### Overview
Registrar eventos de auth (login, logout, creación de usuario, eliminación de usuario) en AuditLog.

### Changes Required:

#### 1. Audit Log helpers
**File**: `src/features/users/users.service.ts`
**Changes**: Agregar logging de audit después de cada operación exitosa.

Necesitamos importar prisma directamente para crear audit logs (o crear un audit repo).

Crear un audit helper reutilizable:

**File**: `src/features/audit/audit.repo.ts` (NUEVO, si no existe)

```typescript
import { prisma } from "@/lib/prisma";

export async function createAuditLog(data: {
  entity: string;
  entityId: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.auditLog.create({
    data: {
      entity: data.entity,
      entityId: data.entityId,
      action: data.action,
      oldValue: data.oldValue ?? null,
      newValue: data.newValue ?? null,
      metadata: data.metadata ?? null,
    },
  });
}
```

#### 2. Agregar audit logs al service de users
**File**: `src/features/users/users.service.ts`
**Changes**: Después de cada operación exitosa, crear un audit log.

```typescript
import * as auditRepo from "@/features/audit/audit.repo";

// En validateCredentials, después del return success:
// (Nota: esto requiere que la action llame el audit, no el service,
//  porque el service no sabe quién hizo login)

// En createUser, después de repo.create:
await auditRepo.createAuditLog({
  entity: "User",
  entityId: user.id,
  action: "CREATE",
  newValue: JSON.stringify({ email: data.email, name: data.name, role: data.role }),
});

// En deleteUser, después de repo.deleteById:
await auditRepo.createAuditLog({
  entity: "User",
  entityId: id,
  action: "DELETE",
  oldValue: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
});
```

#### 3. Agregar audit log para login/logout en actions
**File**: `src/lib/actions/auth.ts`
**Changes**: Registrar login y logout.

```typescript
import * as auditRepo from "@/features/audit/audit.repo";

// En login, después de createSession:
await auditRepo.createAuditLog({
  entity: "User",
  entityId: result.data.id,
  action: "LOGIN",
});

// En logout, antes de deleteSession:
const session = await getSession();
if (session?.userId) {
  await auditRepo.createAuditLog({
    entity: "User",
    entityId: session.userId,
    action: "LOGOUT",
  });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeCheck pasa: `npm run typecheck`
- [ ] No errores de lint: `npm run lint`

#### Manual Verification:
- [ ] Login → verificar en Prisma Studio que se creó AuditLog con action "LOGIN"
- [ ] Crear usuario → AuditLog con action "CREATE" y newValue con datos del usuario
- [ ] Eliminar usuario → AuditLog con action "DELETE" y oldValue con datos
- [ ] Logout → AuditLog con action "LOGOUT"

**Pausa aquí para confirmación manual.**

---

## Testing Strategy

### Automated Tests:
- `src/lib/validations/auth.test.ts` — Tests para loginSchema y createUserSchema (siguiendo patrón existente de los 7 test files)

### Manual Testing Steps:
1. Seed: `npx prisma db seed` → admin existe
2. Login con admin@cop.com / admin123 → acceso al dashboard
3. Login con credenciales incorrectas → error
4. Acceder a ruta sin sesión → redirect a /login
5. Admin: crear usuario sales
6. Login con nuevo usuario sales
7. Sales: no ve "Usuarios" en sidebar
8. Sales: acceder a /usuarios → redirect a /
9. Admin: eliminar usuario sales
10. Admin: intentar eliminarse a sí mismo → error
11. Logout → redirect a /login
12. Verificar AuditLog en Prisma Studio

## Migration Notes

- La migración agrega la tabla `User` — no afecta tablas existentes
- El seed agrega un usuario admin — no modifica datos existentes
- Los route groups no cambian URLs — las rutas siguen igual
- La reorganización de archivos (move a `(dashboard)/`) es puramente estructural

## Performance Considerations

- `verifySession` usa `React.cache()` para deduplicar llamadas dentro del mismo render
- JWT decrypt es una operación ligera (sin DB call en proxy.ts)
- Session refresh solo re-encrypt cuando queda menos de 1 día

## References

- Research: `thoughts/shared/research/2026-02-27_16-28-41_[general]_autenticacion-roles-estado-actual-y-opciones.md`
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js 16 proxy.ts docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [jose library](https://github.com/panva/jose)
- Pattern reference: `src/features/categories/` (categories feature as template)
