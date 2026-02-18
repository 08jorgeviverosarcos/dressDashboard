import type { ActionResult } from "@/types";
import type { ClientFormData } from "@/lib/validations/client";
import * as repo from "./clients.repo";

export function getClients(search?: string) {
  return repo.findAll(search);
}

export function getClient(id: string) {
  return repo.findById(id);
}

export async function createClient(
  parsed: ClientFormData
): Promise<ActionResult<{ id: string }>> {
  const client = await repo.create({
    name: parsed.name,
    phone: parsed.phone || null,
    email: parsed.email || null,
    notes: parsed.notes || null,
  });

  return { success: true, data: { id: client.id } };
}

export async function updateClient(
  id: string,
  parsed: ClientFormData
): Promise<ActionResult> {
  await repo.update(id, {
    name: parsed.name,
    phone: parsed.phone || null,
    email: parsed.email || null,
    notes: parsed.notes || null,
  });

  return { success: true, data: undefined };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const orderCount = await repo.countOrders(id);
  if (orderCount > 0) {
    return { success: false, error: "No se puede eliminar un cliente con pedidos asociados" };
  }

  await repo.deleteById(id);
  return { success: true, data: undefined };
}
