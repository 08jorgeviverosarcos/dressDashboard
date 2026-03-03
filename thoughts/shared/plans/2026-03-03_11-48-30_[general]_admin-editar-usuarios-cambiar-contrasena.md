# Edición de Usuarios por Admin + Cambio de Contraseña Implementation Plan

## Overview

Implementar la capacidad para que usuarios con rol `ADMIN` puedan editar usuarios existentes (nombre, email, rol) e incluir cambio de contraseña dentro del mismo flujo de edición, manteniendo la arquitectura actual `UI -> Actions -> Services -> Repos`, el contrato `ActionResult`, y las convenciones de validación/revalidación del proyecto.

## Current State Analysis

Actualmente el módulo de usuarios permite `listar`, `crear` y `eliminar` (soft delete), pero no existe edición:

- `src/lib/actions/auth.ts` contiene `getUsers`, `createUser`, `deleteUser` (sin `updateUser` ni `changePassword`).
- `src/features/users/users.service.ts` solo maneja `validateCredentials`, `createUser`, `deleteUser`.
- `src/features/users/users.repo.ts` solo tiene `findByEmail`, `findById`, `findAll`, `create`, `deleteById`.
- La UI de usuarios tiene:
  - listado: `src/app/(dashboard)/usuarios/page.tsx`
  - tabla: `src/app/(dashboard)/usuarios/users-table.tsx`
  - creación: `src/app/(dashboard)/usuarios/nuevo/page.tsx`
  - sin ruta de edición `src/app/(dashboard)/usuarios/[id]/editar/page.tsx`.

Patrones de referencia para updates en el proyecto:

- `src/lib/actions/clients.ts`, `src/lib/actions/categories.ts`, `src/lib/actions/products.ts`: `safeParse` + `service` + `revalidatePath`.
- `src/features/*/*.service.ts`: validaciones de negocio (ej. unicidad) antes de `repo.update`.
- `src/features/*/*.repo.ts`: queries Prisma puras.
- Edit pages con `react-hook-form + zodResolver + toast + router.push` en `src/app/(dashboard)/clientes/[id]/editar/page.tsx` y `src/app/(dashboard)/categorias/[id]/editar/page.tsx`.

## Desired End State

Al terminar:

1. Admin puede abrir una página de edición de usuario desde la tabla de usuarios.
2. Admin puede actualizar nombre, email y rol de un usuario.
3. Admin puede cambiar contraseña de un usuario desde la misma edición (campo opcional; si viene vacío, no cambia contraseña).
4. La validación de inputs permanece en `src/lib/validations/auth.ts` y en `auth` actions.
5. El service de usuarios aplica reglas de negocio:
   - email único excluyendo el mismo usuario;
   - bloquear auto-degradación de rol admin (si aplica al usuario actual).
6. Las actualizaciones generan auditoría (`UPDATE`) en `AuditLog`.
7. Se revalidan rutas de usuarios para reflejar cambios en listado/detalle.

### Key Discoveries:

- Patrón de action update con zod + revalidate: `src/lib/actions/clients.ts`.
- Patrón de validación de unicidad en service: `src/features/categories/categories.service.ts`.
- Patrón UI edición con `useForm` y `toast`: `src/app/(dashboard)/clientes/[id]/editar/page.tsx`.
- Soft delete de `User` ya está implementado: `src/features/users/users.repo.ts`.

## What We're NOT Doing

- No se implementa flujo "olvidé mi contraseña" ni recuperación por correo.
- No se implementa cambio de contraseña para usuario autenticado no-admin.
- No se agregan nuevos roles ni permisos granulares.
- No se migran rutas ni arquitectura a API routes.
- No se modifica el modelo de sesión/JWT.

## Implementation Approach

Extender el feature actual de usuarios de manera incremental:

1. Ampliar validaciones y capa service/repo para update.
2. Exponer update en server action con autorización admin.
3. Agregar UI de edición y acceso desde la tabla.
4. Verificar seguridad de reglas (admin-only + consistencia de rol + password hash).

Se mantiene el estilo del módulo actual (`auth.ts` + `users.service.ts` + `users.repo.ts`) para minimizar riesgo y conservar consistencia.

## Phase 1: Dominio de Update de Usuario (Validation + Service + Repo)

### Overview

Agregar capacidades de actualización en backend de usuarios sin UI todavía, para tener reglas de negocio y persistencia listas.

### Changes Required:

#### 1. Extender schema de validación de auth
**File**: `src/lib/validations/auth.ts`  
**Changes**:
- Agregar `updateUserSchema` y `UpdateUserFormData`.
- Campos: `name`, `email`, `role`, `password?`.
- `password` opcional con `min(6)` solo si se envía.

```ts
export const updateUserSchema = z.object({
  email: z.string().min(1, "El email es requerido").email("Email inválido"),
  name: z.string().min(1, "El nombre es requerido"),
  role: z.enum(["ADMIN", "SALES"]),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});
```

#### 2. Extender repo de usuarios
**File**: `src/features/users/users.repo.ts`  
**Changes**:
- Agregar `findByEmailExcluding(email, excludeId)`.
- Agregar `updateById(id, data)` con `prisma.user.update`.

```ts
export async function findByEmailExcluding(email: string, excludeId: string) {
  return prisma.user.findFirst({ where: { email, NOT: { id: excludeId } } });
}
```

#### 3. Extender service de usuarios
**File**: `src/features/users/users.service.ts`  
**Changes**:
- Agregar `updateUser(id, data, currentUserId)`:
  - validar existencia de usuario;
  - validar email único excluyendo mismo id;
  - si `id === currentUserId` y `role` nuevo no es `ADMIN`, rechazar (evita auto-democión);
  - hashear `password` si viene en payload;
  - delegar a `repo.updateById`.
- Mantener `ActionResult` con mensajes de error claros.

```ts
if (id === currentUserId && data.role !== "ADMIN") {
  return { success: false, error: "No puedes quitarte el rol de administrador" };
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking pasa: `pnpm typecheck` (o `npm run typecheck` según proyecto)
- [ ] Lint pasa: `pnpm lint` (o `npm run lint`)

#### Manual Verification:
- [x] No aplica UI aún; solo revisión de código por capas y firmas TypeScript.
- [x] Se confirma que service no importa APIs de Next.js y repo no contiene lógica de negocio.

**Implementation Note**: Después de completar esta fase y verificar checks automáticos, pausar para confirmación humana antes de avanzar.

---

## Phase 2: Server Action de Update (Autorización + Revalidación + Auditoría)

### Overview

Exponer actualización de usuarios desde server action con autorización admin y auditoría.

### Changes Required:

#### 1. Agregar action `updateUser` en auth actions
**File**: `src/lib/actions/auth.ts`  
**Changes**:
- Añadir `updateUser(id, data)`:
  - `verifySession`;
  - guard `session.role === "ADMIN"`;
  - `safeParse(updateUserSchema)`;
  - llamada `service.updateUser(id, parsed.data, session.userId)`;
  - `revalidatePath("/usuarios")`;
  - registrar `AuditLog` con acción `UPDATE` y datos no sensibles.

```ts
if (session.role !== "ADMIN") {
  return { success: false, error: "No autorizado" };
}
```

#### 2. Definir payload de auditoría sin exponer password
**File**: `src/lib/actions/auth.ts`  
**Changes**:
- En `newValue`/`oldValue` incluir solo `email`, `name`, `role`.
- No guardar contraseña ni hash en logs.

### Success Criteria:

#### Automated Verification:
- [x] Type checking pasa: `pnpm typecheck` / `npm run typecheck`
- [ ] Lint pasa: `pnpm lint` / `npm run lint`

#### Manual Verification:
- [x] Acción retorna `No autorizado` si la invoca un no-admin.
- [x] Acción no serializa `password` ni `passwordHash` en audit log.
- [x] Al éxito, `/usuarios` refleja cambios tras revalidación.

**Implementation Note**: Después de completar esta fase y verificar checks automáticos, pausar para confirmación humana antes de avanzar.

---

## Phase 3: UI de Edición de Usuario (Ruta + Formulario)

### Overview

Crear la experiencia de edición en dashboard para admin reutilizando patrones de edición existentes.

### Changes Required:

#### 1. Crear ruta de edición
**File**: `src/app/(dashboard)/usuarios/[id]/editar/page.tsx`  
**Changes**:
- Página client o server+client siguiendo patrón de `clientes/[id]/editar`.
- Cargar usuario con `getUser` (o una action `getUserForEdit` si se requiere shape controlado).
- Form con `react-hook-form` + `zodResolver(updateUserSchema)`.
- Campos: `name`, `email`, `role`, `password` (opcional, placeholder claro).
- Submit a `updateUser`.

#### 2. Agregar acceso desde tabla de usuarios
**File**: `src/app/(dashboard)/usuarios/users-table.tsx`  
**Changes**:
- Incluir acción de editar por fila (botón/icono) con navegación a `/usuarios/{id}/editar`.
- Mantener `e.stopPropagation()` en botones de acción.
- Mantener acción de eliminar existente.

#### 3. Navegación post-submit y mensajes UX
**Files**:
- `src/app/(dashboard)/usuarios/[id]/editar/page.tsx`
- opcional `src/features/users/users.strings.ts` si se externalizan textos

**Changes**:
- `toast.success("Usuario actualizado exitosamente")` al guardar.
- `toast.error(...)` en error.
- Redirección de vuelta a `/usuarios`.

### Success Criteria:

#### Automated Verification:
- [x] Type checking pasa: `pnpm typecheck` / `npm run typecheck`
- [ ] Lint pasa: `pnpm lint` / `npm run lint`
- [x] Build pasa: `pnpm build` / `npm run build`

#### Manual Verification:
- [x] Admin ve botón de editar en tabla de usuarios.
- [x] Admin puede editar nombre/email/rol y guardar.
- [x] Si password queda vacío, contraseña actual se mantiene.
- [x] Si password se diligencia, el usuario afectado puede iniciar con nueva contraseña.
- [x] Si email duplicado, aparece error de negocio esperado.
- [x] Intento de auto-democión de admin muestra error esperado.
- [x] Layout responsive: formulario en `grid grid-cols-1 ... sm:grid-cols-*` y botones `flex flex-col ... sm:flex-row`.

**Implementation Note**: Después de completar esta fase y verificar checks automáticos, pausar para confirmación humana antes de avanzar.

---

## Phase 4: Robustez y Cobertura de Regresiones

### Overview

Asegurar que el nuevo flujo no rompa login/usuarios existentes y que respete seguridad de credenciales.

### Changes Required:

#### 1. Ajustes de consistencia en actions/services
**Files**:
- `src/lib/actions/auth.ts`
- `src/features/users/users.service.ts`

**Changes**:
- Revisar mensajes de error consistentes en español.
- Confirmar que todas las respuestas siguen `ActionResult`.
- Confirmar que cambios de contraseña usan bcrypt con rounds existentes (`BCRYPT_ROUNDS`).

#### 2. Pruebas manuales de regresión de auth
**Scope**:
- Login admin y sales.
- Crear usuario.
- Editar usuario sin password.
- Editar usuario con password.
- Eliminar usuario.
- Guards de `/usuarios` para no-admin.

### Success Criteria:

#### Automated Verification:
- [x] Type checking final pasa: `pnpm typecheck` / `npm run typecheck`
- [ ] Lint final pasa: `pnpm lint` / `npm run lint`
- [x] Build final pasa: `pnpm build` / `npm run build`

#### Manual Verification:
- [x] Flujo completo admin usuarios funciona end-to-end.
- [x] Login mantiene comportamiento previo (credenciales válidas/invalidas).
- [x] No hay exposición de password/hash en UI/logs.
- [x] No hay regresiones en guard de roles (`proxy.ts` + página `/usuarios`).

**Implementation Note**: Después de completar esta fase y verificar checks automáticos, pausar para confirmación humana final.

---

## Testing Strategy

### Unit Tests:

- Validación de `updateUserSchema`:
  - password opcional;
  - password < 6 falla;
  - email inválido falla.
- Service `updateUser`:
  - rechaza email duplicado;
  - rechaza auto-democión admin;
  - actualiza sin password;
  - actualiza con password (hash nuevo).

### Integration Tests:

- Action `updateUser`:
  - no-admin recibe `No autorizado`;
  - admin actualiza usuario con éxito;
  - revalidación de `/usuarios` ejecutada en éxito.

### Manual Testing Steps:

1. Iniciar sesión como admin.
2. Ir a `/usuarios` y abrir editar en un usuario sales.
3. Cambiar nombre/email/rol sin password y guardar.
4. Confirmar cambios en tabla y que login del usuario sigue funcionando con password anterior.
5. Editar nuevamente, definir nueva password y guardar.
6. Cerrar sesión y probar login del usuario con password nueva.
7. Como sales, intentar entrar a `/usuarios` y validar redirección.
8. Como admin actual, intentar cambiar su rol a sales y validar bloqueo.

## Performance Considerations

- El impacto de performance es mínimo: updates puntuales sobre `User`.
- Hash de bcrypt solo se ejecuta cuando se envía password nueva.
- No se agregan consultas masivas ni nuevas transacciones complejas.

## Migration Notes

- No requiere cambios en `prisma/schema.prisma` ni nuevas migraciones.
- Se reutiliza la estructura actual de auth/users.
- Compatible con datos existentes (usuarios actuales sin modificaciones de esquema).

## References

- Research principal: `thoughts/shared/research/2026-03-03_11-31-58_[general]_admin-modificar-usuarios-cambiar-contrasena-estado-actual.md`
- Related research: `thoughts/shared/research/2026-02-27_16-28-41_[general]_autenticacion-roles-estado-actual-y-opciones.md`
- Related plan: `thoughts/shared/plans/2026-02-27_21-48-37_[general]_autenticacion-roles-implementacion.md`
- Patrón action update: `src/lib/actions/clients.ts`
- Patrón service unicidad: `src/features/categories/categories.service.ts`
- Patrón UI edición: `src/app/(dashboard)/clientes/[id]/editar/page.tsx`
