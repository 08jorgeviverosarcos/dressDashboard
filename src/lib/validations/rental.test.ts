import { describe, it, expect } from "vitest";
import { rentalSchema } from "./rental";

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
