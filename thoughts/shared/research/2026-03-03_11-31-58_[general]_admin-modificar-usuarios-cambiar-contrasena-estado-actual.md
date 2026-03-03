---
date: "2026-03-03T11:31:38-05:00"
researcher: "Cursor Agent"
git_commit: "92f3813d191120ae42fc9acbdb9fe68bcccc034c"
branch: "main"
repository: "dressDashboard"
topic: "Poder modificar usuarios si es admin, inclusive cambiar contraseña"
tags: [research, users, auth, roles, admin, password]
status: complete
last_updated: "2026-03-03"
last_updated_by: "Cursor Agent"
---

# Research: Poder modificar usuarios si es admin, inclusive cambiar contraseña

**Date**: 2026-03-03T11:31:38-05:00  
**Researcher**: Cursor Agent  
**Git Commit**: 92f3813d191120ae42fc9acbdb9fe68bcccc034c  
**Branch**: main  
**Repository**: dressDashboard

## Research Question

¿Actualmente en el sistema un admin puede modificar usuarios, incluyendo cambiar contraseña?

## Summary

En el estado actual del codebase, el módulo de usuarios para `ADMIN` permite **listar**, **crear** y **eliminar lógicamente** usuarios, pero **no existe flujo de edición de usuario** ni **flujo de cambio de contraseña** para usuarios existentes.

La contraseña solo aparece en dos casos: login (validación de credenciales) y creación de usuario (hash inicial con bcrypt). No hay `updateUser`, `changePassword`, `resetPassword` ni rutas UI de edición (`/usuarios/[id]` o `/usuarios/[id]/editar`).

## Detailed Findings

### Acceso admin a gestión de usuarios

- El item de navegación `Usuarios` se muestra solo para rol `ADMIN` en sidebar:  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/components/layout/Sidebar.tsx#L35-L50`
- La ruta `/usuarios` se protege en `proxy.ts` para bloquear usuarios no admin:  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/proxy.ts#L24-L27`
- La página `src/app/(dashboard)/usuarios/page.tsx` vuelve a validar `session.role === "ADMIN"` y redirige si no cumple:  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/app/(dashboard)/usuarios/page.tsx#L7-L11`

### Operaciones disponibles hoy en usuarios

- **Listar usuarios**: `getUsers` en action delega a `users.service.getUsers` (solo para admin).  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/lib/actions/auth.ts#L54-L60`
- **Crear usuario**: `createUser` valida con `createUserSchema`, verifica admin, hashea password y crea registro.  
  - Action: `src/lib/actions/auth.ts`  
    `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/lib/actions/auth.ts#L62-L95`
  - Service (hash con bcrypt): `src/features/users/users.service.ts`  
    `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/features/users/users.service.ts#L39-L59`
  - Repo (create): `src/features/users/users.repo.ts`  
    `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/features/users/users.repo.ts#L28-L37`
- **Eliminar usuario**: botón en tabla + action + service + soft delete (`deletedAt`).  
  - UI (`UsersTable`):  
    `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/app/(dashboard)/usuarios/users-table.tsx#L63-L93`
  - Action:  
    `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/lib/actions/auth.ts#L97-L122`
  - Service (evita auto-eliminación):  
    `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/features/users/users.service.ts#L61-L76`
  - Repo (soft delete):  
    `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/features/users/users.repo.ts#L39-L44`

### Contraseña: dónde se usa y qué no existe

- **Sí existe** validación de contraseña en login (`bcrypt.compare`):  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/features/users/users.service.ts#L7-L29`
- **Sí existe** hash de contraseña al crear usuario (`bcrypt.hash`):  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/features/users/users.service.ts#L50-L56`
- **No existe** función de actualización de contraseña de un usuario existente (no hay symbols `changePassword`, `resetPassword`, `updateUser` en `src/`).
- El schema Zod de auth solo cubre `loginSchema` y `createUserSchema`:  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/lib/validations/auth.ts#L3-L19`

### Modelo de datos relevante

- Modelo `User` tiene `passwordHash`, `role`, `deletedAt` (soft delete):  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/prisma/schema.prisma#L213-L225`
- Prisma extension filtra automáticamente `deletedAt: null` para lecturas en modelos soft-delete, incluyendo `User`:  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/lib/prisma.ts#L5-L16`  
  `https://github.com/08jorgeviverosarcos/dressDashboard/blob/92f3813d191120ae42fc9acbdb9fe68bcccc034c/src/lib/prisma.ts#L25-L58`

## Code References

- `src/lib/actions/auth.ts` - login/logout/getUsers/createUser/deleteUser
- `src/features/users/users.service.ts` - validateCredentials/createUser/deleteUser
- `src/features/users/users.repo.ts` - find/create/deleteById
- `src/app/(dashboard)/usuarios/page.tsx` - guard de rol admin en página
- `src/app/(dashboard)/usuarios/users-table.tsx` - acciones de tabla (solo eliminar)
- `src/app/(dashboard)/usuarios/nuevo/page.tsx` - formulario de alta con password
- `src/lib/validations/auth.ts` - esquemas de login y creación
- `src/components/layout/Sidebar.tsx` - item Usuarios solo para admin
- `proxy.ts` - bloqueo de `/usuarios` para no-admin
- `prisma/schema.prisma` - modelo User y enum UserRole
- `src/lib/prisma.ts` - extensión soft-delete

## Architecture Insights

- El flujo sigue arquitectura por capas: UI (`app/(dashboard)/usuarios`) -> Server Actions (`src/lib/actions/auth.ts`) -> Service (`src/features/users/users.service.ts`) -> Repo (`src/features/users/users.repo.ts`) -> Prisma.
- El control de acceso admin está duplicado de forma defensiva en dos lugares: `proxy.ts` (nivel request) y la página server component de `/usuarios`.
- La gestión de credenciales está limitada a autenticación y creación; no hay ciclo completo de mantenimiento de contraseña para usuarios existentes.

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-27_21-48-37_[general]_autenticacion-roles-implementacion.md` documenta como alcance de usuarios para admin: listar/crear/eliminar; explícitamente deja fuera recuperación de contraseña.
- `thoughts/shared/research/2026-02-27_16-28-41_[general]_autenticacion-roles-estado-actual-y-opciones.md` describe la implementación base de auth/roles y también sin flujo de cambio de contraseña.

## Related Research

- `thoughts/shared/research/2026-02-27_16-28-41_[general]_autenticacion-roles-estado-actual-y-opciones.md`
- `thoughts/shared/plans/2026-02-27_21-48-37_[general]_autenticacion-roles-implementacion.md`
- `thoughts/shared/research/2026-03-03_10-11-07_[general]_factura-costos-dashboard-financiero-filtros-admin.md`

## Open Questions

- ¿La necesidad es que **admin cambie contraseña de otros usuarios** o que **cada usuario cambie su propia contraseña**?
- ¿El cambio de contraseña debe exigir contraseña temporal/actual, o será reemplazo directo por admin?
