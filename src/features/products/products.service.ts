import type { ActionResult } from "@/types";
import type { ProductFormData } from "@/lib/validations/product";
import * as repo from "./products.repo";

export function getProducts(filters?: {
  search?: string;
  type?: "DRESS" | "ACCESSORY" | "SERVICE";
  categoryId?: string;
}) {
  return repo.findAll(filters);
}

export function getProduct(id: string) {
  return repo.findById(id);
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
