"use server";

import { productSchema, type ProductFormData } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { ProductType } from "@prisma/client";
import * as service from "@/features/products/products.service";

export async function getProducts(filters?: {
  search?: string;
  type?: ProductType;
  categoryId?: string;
}) {
  return service.getProducts(filters);
}

export async function getProduct(id: string) {
  return service.getProduct(id);
}

export async function getSuggestedProductCode(
  categoryId: string
): Promise<ActionResult<{ code: string }>> {
  const parsedCategoryId = categoryId.trim();
  if (!parsedCategoryId) {
    return { success: false, error: "La categoría es requerida" };
  }

  return service.getSuggestedProductCode(parsedCategoryId);
}

export async function createProduct(data: ProductFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createProduct(parsed.data);
  if (result.success) revalidatePath("/productos");
  return result;
}

export async function updateProduct(id: string, data: ProductFormData): Promise<ActionResult> {
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateProduct(id, parsed.data);
  if (result.success) {
    revalidatePath("/productos");
    revalidatePath(`/productos/${id}`);
  }
  return result;
}
