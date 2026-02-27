import type { ProductType } from "@prisma/client";
import type { ActionResult } from "@/types";
import type { ProductFormData } from "@/lib/validations/product";
import * as repo from "./products.repo";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getProducts(filters?: {
  search?: string;
  type?: ProductType;
  categoryId?: string;
}) {
  return repo.findAll(filters);
}

export function getProduct(id: string) {
  return repo.findById(id);
}

export async function getSuggestedProductCode(
  categoryId: string
): Promise<ActionResult<{ code: string }>> {
  const category = await repo.findCategoryById(categoryId);
  if (!category) {
    return { success: false, error: "Categoría no encontrada" };
  }

  const prefix = category.code.trim();
  if (!prefix) {
    return { success: false, error: "La categoría no tiene código configurado" };
  }

  const existingCodes = await repo.findCodesByCategoryAndPrefix(categoryId, prefix);
  const regex = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);

  let maxSequential = 0;
  for (const item of existingCodes) {
    const match = item.code.match(regex);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isNaN(value)) continue;
    if (value > maxSequential) maxSequential = value;
  }

  const nextSequential = String(maxSequential + 1).padStart(3, "0");
  return { success: true, data: { code: `${prefix}-${nextSequential}` } };
}

export async function createProduct(
  parsed: ProductFormData
): Promise<ActionResult<{ id: string }>> {
  const existing = await repo.findByCode(parsed.code);
  if (existing) {
    return { success: false, error: `Ya existe un producto con el código ${parsed.code}` };
  }

  const product = await repo.create({
    code: parsed.code,
    name: parsed.name,
    type: parsed.type,
    inventoryTracking: parsed.inventoryTracking,
    category: parsed.categoryId
      ? { connect: { id: parsed.categoryId } }
      : undefined,
    salePrice: parsed.salePrice ?? null,
    rentalPrice: parsed.rentalPrice ?? null,
    cost: parsed.cost ?? null,
    description: parsed.description || null,
    imageUrl: parsed.imageUrl || null,
  });

  return { success: true, data: { id: product.id } };
}

export async function updateProduct(
  id: string,
  parsed: ProductFormData
): Promise<ActionResult> {
  const existing = await repo.findByCodeExcluding(parsed.code, id);
  if (existing) {
    return { success: false, error: `Ya existe otro producto con el código ${parsed.code}` };
  }

  await repo.update(id, {
    code: parsed.code,
    name: parsed.name,
    type: parsed.type,
    inventoryTracking: parsed.inventoryTracking,
    category: parsed.categoryId
      ? { connect: { id: parsed.categoryId } }
      : { disconnect: true },
    salePrice: parsed.salePrice ?? null,
    rentalPrice: parsed.rentalPrice ?? null,
    cost: parsed.cost ?? null,
    description: parsed.description || null,
    imageUrl: parsed.imageUrl || null,
  });

  return { success: true, data: undefined };
}
