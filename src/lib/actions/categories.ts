"use server";

import { categorySchema, type CategoryFormData } from "@/lib/validations/category";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/categories/categories.service";
import { verifySession } from "@/lib/dal";
import * as auditRepo from "@/features/audit/audit.repo";

export async function getCategories(filters?: { search?: string }) {
  return service.getCategories(filters);
}

export async function getCategory(id: string) {
  return service.getCategory(id);
}

export async function createCategory(data: CategoryFormData): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createCategory(parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Category",
      entityId: result.data.id,
      action: "CREATED",
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/categorias");
  }
  return result;
}

export async function updateCategory(id: string, data: CategoryFormData): Promise<ActionResult> {
  const session = await verifySession();
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateCategory(id, parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Category",
      entityId: id,
      action: "UPDATED",
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/categorias");
  }
  return result;
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.deleteCategory(id);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Category",
      entityId: id,
      action: "DELETED",
      userId: session.userId,
    });
    revalidatePath("/categorias");
  }
  return result;
}
