import type { ActionResult } from "@/types";
import type { InventoryStatus } from "@prisma/client";
import * as repo from "./inventory.repo";
import * as productsRepo from "@/features/products/products.repo";

export function getInventoryItems(filters?: {
  search?: string;
  status?: InventoryStatus;
}) {
  return repo.findAll(filters);
}

function generateAssetCodes(
  productCode: string,
  existingCodes: (string | null)[],
  count: number
): string[] {
  const suffixes = existingCodes
    .filter(Boolean)
    .map((c) => {
      const match = c!.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const maxSuffix = suffixes.length > 0 ? Math.max(...suffixes) : 0;
  return Array.from({ length: count }, (_, i) => {
    const n = maxSuffix + i + 1;
    return `${productCode}-${String(n).padStart(2, "0")}`;
  });
}

export async function createInventoryItem(data: {
  productId: string;
  inventoryTracking: "UNIT" | "QUANTITY";
  unitCount?: number;
  quantityOnHand?: number;
  notes?: string;
}): Promise<ActionResult<{ ids: string[] }>> {
  if (!data.productId) {
    return { success: false, error: "Seleccione un producto" };
  }

  if (data.inventoryTracking === "UNIT") {
    const product = await productsRepo.findById(data.productId);
    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }
    const count = data.unitCount ?? 1;
    const existingCodes = await repo.findAssetCodesByProductId(data.productId);
    const codes = generateAssetCodes(
      product.code,
      existingCodes.map((r) => r.assetCode),
      count
    );
    const items = await repo.createMany(
      codes.map((code) => ({
        productId: data.productId,
        assetCode: code,
        quantityOnHand: 1,
        status: "AVAILABLE" as const,
        notes: data.notes || null,
      }))
    );
    return { success: true, data: { ids: items.map((i) => i.id) } };
  } else {
    // QUANTITY: 1 InventoryItem with quantityOnHand = N
    const item = await repo.create({
      productId: data.productId,
      assetCode: null,
      quantityOnHand: data.quantityOnHand ?? 1,
      status: "AVAILABLE",
      notes: data.notes || null,
    });
    return { success: true, data: { ids: [item.id] } };
  }
}

export async function updateInventoryStatus(
  id: string,
  status: InventoryStatus
): Promise<ActionResult> {
  await repo.updateStatus(id, status);
  return { success: true, data: undefined };
}

export async function updateInventoryItem(
  id: string,
  data: { quantityOnHand?: number; status?: InventoryStatus; notes?: string }
): Promise<ActionResult> {
  await repo.update(id, data);
  return { success: true, data: undefined };
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  const linkedOrders = await repo.countLinkedOrders(id);
  if (linkedOrders > 0) {
    return { success: false, error: "Este item está vinculado a pedidos existentes" };
  }

  await repo.deleteById(id);
  return { success: true, data: undefined };
}

export function getInventoryItem(id: string) {
  return repo.findById(id);
}

export function getAvailableUnitInventoryItems() {
  return repo.findAvailableUnitItems();
}
