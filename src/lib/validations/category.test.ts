import { describe, it, expect } from "vitest";
import { categorySchema } from "./category";

describe("categorySchema", () => {
  it("accepts valid data", () => {
    const result = categorySchema.safeParse({ name: "Vestidos", code: "VES" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = categorySchema.safeParse({ name: "", code: "VES" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El nombre es requerido");
    }
  });

  it("rejects empty code", () => {
    const result = categorySchema.safeParse({ name: "Vestidos", code: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El código es requerido");
    }
  });
});
