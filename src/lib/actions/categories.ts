"use server";

import { prisma } from "@/lib/prisma";
import { categorySchema, type CategoryFormData } from "@/lib/validations/category";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getCategory(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: { products: { where: { isActive: true } } },
  });
}

export async function createCategory(data: CategoryFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const existing = await prisma.category.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return { success: false, error: `Ya existe una categoría con el código ${parsed.data.code}` };
  }

  const category = await prisma.category.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
    },
  });

  revalidatePath("/categorias");
  return { success: true, data: { id: category.id } };
}

export async function updateCategory(id: string, data: CategoryFormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const existing = await prisma.category.findFirst({
    where: { code: parsed.data.code, NOT: { id } },
  });
  if (existing) {
    return { success: false, error: `Ya existe otra categoría con el código ${parsed.data.code}` };
  }

  await prisma.category.update({
    where: { id },
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
    },
  });

  revalidatePath("/categorias");
  return { success: true, data: undefined };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const productsCount = await prisma.product.count({
    where: { categoryId: id, isActive: true },
  });

  if (productsCount > 0) {
    return {
      success: false,
      error: `No se puede eliminar porque tiene ${productsCount} producto(s) asociado(s)`,
    };
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/categorias");
  return { success: true, data: undefined };
}
