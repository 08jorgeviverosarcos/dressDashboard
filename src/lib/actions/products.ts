"use server";

import { prisma } from "@/lib/prisma";
import { productSchema, type ProductFormData } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { ProductType } from "@prisma/client";

export async function getProducts(filters?: {
  search?: string;
  type?: ProductType;
  categoryId?: string;
}) {
  const where: Record<string, unknown> = { isActive: true };

  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters?.type) where.type = filters.type;
  if (filters?.categoryId) where.categoryId = filters.categoryId;

  return prisma.product.findMany({
    where,
    include: { inventoryItems: true, category: true },
    orderBy: { code: "asc" },
  });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      inventoryItems: { orderBy: { createdAt: "desc" } },
      orderItems: {
        include: { order: { include: { client: true } } },
        orderBy: { order: { orderDate: "desc" } },
        take: 10,
      },
    },
  });
}

export async function createProduct(data: ProductFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const existing = await prisma.product.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return { success: false, error: `Ya existe un producto con el código ${parsed.data.code}` };
  }

  const product = await prisma.product.create({
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      type: parsed.data.type,
      category: parsed.data.categoryId
        ? { connect: { id: parsed.data.categoryId } }
        : undefined,
      salePrice: parsed.data.salePrice ?? null,
      rentalPrice: parsed.data.rentalPrice ?? null,
      cost: parsed.data.cost ?? null,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
    },
  });

  revalidatePath("/productos");
  return { success: true, data: { id: product.id } };
}

export async function updateProduct(id: string, data: ProductFormData): Promise<ActionResult> {
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const existing = await prisma.product.findFirst({
    where: { code: parsed.data.code, NOT: { id } },
  });
  if (existing) {
    return { success: false, error: `Ya existe otro producto con el código ${parsed.data.code}` };
  }

  await prisma.product.update({
    where: { id },
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      type: parsed.data.type,
      category: parsed.data.categoryId
        ? { connect: { id: parsed.data.categoryId } }
        : { disconnect: true },
      salePrice: parsed.data.salePrice ?? null,
      rentalPrice: parsed.data.rentalPrice ?? null,
      cost: parsed.data.cost ?? null,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
    },
  });

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  return { success: true, data: undefined };
}
