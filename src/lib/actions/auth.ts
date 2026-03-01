"use server";

import { loginSchema, createUserSchema } from "@/lib/validations/auth";
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
