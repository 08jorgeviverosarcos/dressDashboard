import { describe, it, expect } from "vitest";
import { expenseSchema } from "./expense";

const validExpense = {
  date: new Date("2026-02-22"),
  category: "Materiales",
  description: "Tela para vestido",
  amount: 150000,
  expenseType: "VARIABLE" as const,
  paymentMethod: "CASH" as const,
};

describe("expenseSchema", () => {
  it("accepts valid data", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: -50 });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = expenseSchema.safeParse({ ...validExpense, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty category", () => {
    const result = expenseSchema.safeParse({ ...validExpense, category: "" });
    expect(result.success).toBe(false);
  });

  it("accepts both expense types", () => {
    for (const expenseType of ["FIXED", "VARIABLE"]) {
      const result = expenseSchema.safeParse({ ...validExpense, expenseType });
      expect(result.success).toBe(true);
    }
  });

  it("accepts null orderItemId", () => {
    const result = expenseSchema.safeParse({ ...validExpense, orderItemId: null });
    expect(result.success).toBe(true);
  });

  it("accepts empty string orderItemId", () => {
    const result = expenseSchema.safeParse({ ...validExpense, orderItemId: "" });
    expect(result.success).toBe(true);
  });
});
