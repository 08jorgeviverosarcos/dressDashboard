import { ProductType } from "@prisma/client";

export type DerivedOrderType = "SALE" | "RENTAL" | "SERVICE" | "MIXED";

export function deriveOrderType(
  items: { product: { type: ProductType } }[]
): DerivedOrderType {
  if (items.length === 0) return "SALE";

  const types = new Set(items.map((i) => i.product.type));

  if (types.size === 1) {
    const type = types.values().next().value;
    if (type === "SERVICE") return "SERVICE";
    return "SALE";
  }

  return "MIXED";
}
