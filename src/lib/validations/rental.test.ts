import { describe, it, expect } from "vitest";
import { rentalSchema, rentalCostSchema } from "./rental";

describe("rentalSchema", () => {
  it("accepts valid minimal data", () => {
    const result = rentalSchema.safeParse({ orderItemId: "clx123" });
    expect(result.success).toBe(true);
  });

  it("defaults deposit to 0", () => {
    const result = rentalSchema.safeParse({ orderItemId: "clx123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deposit).toBe(0);
    }
  });

  it("accepts null returnDate", () => {
    const result = rentalSchema.safeParse({ orderItemId: "clx123", returnDate: null });
    expect(result.success).toBe(true);
  });

  it("accepts null actualReturnDate", () => {
    const result = rentalSchema.safeParse({ orderItemId: "clx123", actualReturnDate: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty orderItemId", () => {
    const result = rentalSchema.safeParse({ orderItemId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative deposit", () => {
    const result = rentalSchema.safeParse({ orderItemId: "clx123", deposit: -100 });
    expect(result.success).toBe(false);
  });
});

describe("rentalCostSchema", () => {
  const validCost = {
    rentalId: "clx456",
    type: "Lavado",
    amount: 50000,
  };

  it("accepts valid data", () => {
    const result = rentalCostSchema.safeParse(validCost);
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = rentalCostSchema.safeParse({ ...validCost, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects empty rentalId", () => {
    const result = rentalCostSchema.safeParse({ ...validCost, rentalId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty type", () => {
    const result = rentalCostSchema.safeParse({ ...validCost, type: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional description as empty string", () => {
    const result = rentalCostSchema.safeParse({ ...validCost, description: "" });
    expect(result.success).toBe(true);
  });
});
