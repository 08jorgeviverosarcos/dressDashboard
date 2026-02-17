"use server";

import { prisma } from "@/lib/prisma";
import { clientSchema, type ClientFormData } from "@/lib/validations/client";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function getClients(search?: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  return prisma.client.findMany({
    where,
    include: { orders: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      orders: {
        include: { payments: true },
        orderBy: { orderDate: "desc" },
      },
    },
  });
}

export async function createClient(data: ClientFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/clientes");
  return { success: true, data: { id: client.id } };
}

export async function updateClient(id: string, data: ClientFormData): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await prisma.client.update({
    where: { id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { success: true, data: undefined };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const orderCount = await prisma.order.count({ where: { clientId: id } });
  if (orderCount > 0) {
    return { success: false, error: "No se puede eliminar un cliente con pedidos asociados" };
  }

  await prisma.client.delete({ where: { id } });
  revalidatePath("/clientes");
  return { success: true, data: undefined };
}
