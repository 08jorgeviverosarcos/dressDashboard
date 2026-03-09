"use server";

import { clientSchema, type ClientFormData } from "@/lib/validations/client";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/clients/clients.service";
import { verifySession } from "@/lib/dal";
import * as auditRepo from "@/features/audit/audit.repo";

export async function getClients(search?: string) {
  return service.getClients(search);
}

export async function getClient(id: string) {
  const client = await service.getClient(id);
  if (!client) return null;
  return JSON.parse(JSON.stringify(client));
}

export async function createClient(data: ClientFormData): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createClient(parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Client",
      entityId: result.data.id,
      action: "CREATED",
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/clientes");
  }
  return result;
}

export async function updateClient(id: string, data: ClientFormData): Promise<ActionResult> {
  const session = await verifySession();
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateClient(id, parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Client",
      entityId: id,
      action: "UPDATED",
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
  }
  return result;
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.deleteClient(id);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Client",
      entityId: id,
      action: "DELETED",
      userId: session.userId,
    });
    revalidatePath("/clientes");
  }
  return result;
}
