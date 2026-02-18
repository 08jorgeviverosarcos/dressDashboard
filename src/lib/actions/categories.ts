"use server";

import { categorySchema, type CategoryFormData } from "@/lib/validations/category";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import * as service from "@/features/categories/categories.service";

export async function getCategories() {
  return service.getCategories();
}

export async function getCategory(id: string) {
  return service.getCategory(id);
}

export async function createCategory(data: CategoryFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createCategory(parsed.data);
  if (result.success) revalidatePath("/categorias");
  return result;
}

export async function updateCategory(id: string, data: CategoryFormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateCategory(id, parsed.data);
  if (result.success) revalidatePath("/categorias");
  return result;
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const result = await service.deleteCategory(id);
  if (result.success) revalidatePath("/categorias");
  return result;
}
