"use server";

import {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  type UpdateUserFormData,
} from "@/lib/validations/auth";
import type { ActionResult } from "@/types";
import * as service from "@/features/users/users.service";
import * as auditRepo from "@/features/audit/audit.repo";
import { createSession, deleteSession } from "@/lib/session";
import { verifySession, getSession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function login(data: {
  email: string;
  password: string;
}): Promise<ActionResult<{ name: string }>> {
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

  await auditRepo.createAuditLog({
    entity: "User",
    entityId: result.data.id,
    action: "LOGIN",
    userId: result.data.id,
  });

  return { success: true, data: { name: result.data.name } };
}

export async function logout() {
  const session = await getSession();
  if (session?.userId) {
    await auditRepo.createAuditLog({
      entity: "User",
      entityId: session.userId,
      action: "LOGOUT",
      userId: session.userId,
    });
  }
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

export async function getUser(id: string) {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return null;
  }

  const user = await service.getUser(id);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "SALES";
}): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createUser(parsed.data);

  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "User",
      entityId: result.data.id,
      action: "CREATE",
      userId: session.userId,
      newValue: JSON.stringify({
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
      }),
    });
    revalidatePath("/usuarios");
  }

  return result;
}

export async function updateUser(
  id: string,
  data: UpdateUserFormData
): Promise<ActionResult> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const userBeforeUpdate = await service.getUser(id);

  const result = await service.updateUser(id, parsed.data, session.userId);

  if (result.success) {
    const userAfterUpdate = await service.getUser(id);
    await auditRepo.createAuditLog({
      entity: "User",
      entityId: id,
      action: "UPDATE",
      userId: session.userId,
      oldValue: userBeforeUpdate
        ? JSON.stringify({
            email: userBeforeUpdate.email,
            name: userBeforeUpdate.name,
            role: userBeforeUpdate.role,
          })
        : null,
      newValue: userAfterUpdate
        ? JSON.stringify({
            email: userAfterUpdate.email,
            name: userAfterUpdate.name,
            role: userAfterUpdate.role,
          })
        : JSON.stringify({
            email: parsed.data.email,
            name: parsed.data.name,
            role: parsed.data.role,
          }),
    });
    revalidatePath("/usuarios");
  }

  return result;
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { success: false, error: "No autorizado" };
  }

  const userToDelete = await service.getUser(id);

  const result = await service.deleteUser(id, session.userId);

  if (result.success && userToDelete) {
    await auditRepo.createAuditLog({
      entity: "User",
      entityId: id,
      action: "DELETE",
      userId: session.userId,
      oldValue: JSON.stringify({
        email: userToDelete.email,
        name: userToDelete.name,
        role: userToDelete.role,
      }),
    });
    revalidatePath("/usuarios");
  }

  return result;
}
