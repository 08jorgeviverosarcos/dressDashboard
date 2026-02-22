import { describe, it, expect } from "vitest";
import { productSchema } from "./product";

const validProduct = {
  code: "VES-001",
  name: "Vestido Rojo",
  type: "SALE" as const,
};

describe("productSchema", () => {
  it("accepts valid minimal data", () => {
    const result = productSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("accepts all product types", () => {
    for (const type of ["SALE", "RENTAL", "BOTH"]) {
      const result = productSchema.safeParse({ ...validProduct, type });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty code", () => {
    const result = productSchema.safeParse({ ...validProduct, code: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = productSchema.safeParse({ ...validProduct, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative salePrice", () => {
    const result = productSchema.safeParse({ ...validProduct, salePrice: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects negative rentalPrice", () => {
    const result = productSchema.safeParse({ ...validProduct, rentalPrice: -50 });
    expect(result.success).toBe(false);
  });

  it("rejects negative cost", () => {
    const result = productSchema.safeParse({ ...validProduct, cost: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = productSchema.safeParse({ ...validProduct, type: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts null categoryId", () => {
    const result = productSchema.safeParse({ ...validProduct, categoryId: null });
    expect(result.success).toBe(true);
  });
});
