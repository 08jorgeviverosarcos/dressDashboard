import type { ActionResult } from "@/types";
import * as repo from "./categories.repo";

export function getCategories() {
  return repo.findAll();
}

export function getCategory(id: string) {
  return repo.findById(id);
}

export async function createCategory(
  parsed: { name: string; code: string }
): Promise<ActionResult<{ id: string }>> {
  const existing = await repo.findByCode(parsed.code);
  if (existing) {
    return { success: false, error: `Ya existe una categoría con el código ${parsed.code}` };
  }

  const category = await repo.create({ name: parsed.name, code: parsed.code });
  return { success: true, data: { id: category.id } };
}

export async function updateCategory(
  id: string,
  parsed: { name: string; code: string }
): Promise<ActionResult> {
  const existing = await repo.findByCodeExcluding(parsed.code, id);
  if (existing) {
    return { success: false, error: `Ya existe otra categoría con el código ${parsed.code}` };
  }

  await repo.update(id, { name: parsed.name, code: parsed.code });
  return { success: true, data: undefined };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const count = await repo.countActiveProducts(id);
  if (count > 0) {
    return {
      success: false,
      error: `No se puede eliminar porque tiene ${count} producto(s) asociado(s)`,
    };
  }

  await repo.deleteById(id);
  return { success: true, data: undefined };
}
