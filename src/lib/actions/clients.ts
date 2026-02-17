"use server";

import { clientSchema, type ClientFormData } from "@/lib/validations/client";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/clients/clients.service";

export async function getClients(search?: string) {
  return service.getClients(search);
}

export async function getClient(id: string) {
  return service.getClient(id);
}

export async function createClient(data: ClientFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createClient(parsed.data);
  if (result.success) revalidatePath("/clientes");
  return result;
}

export async function updateClient(id: string, data: ClientFormData): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateClient(id, parsed.data);
  if (result.success) {
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
  }
  return result;
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const result = await service.deleteClient(id);
  if (result.success) revalidatePath("/clientes");
  return result;
}
