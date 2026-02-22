import { describe, it, expect } from "vitest";
import { clientSchema } from "./client";

describe("clientSchema", () => {
  it("accepts valid data with only name", () => {
    const result = clientSchema.safeParse({ name: "Juan Pérez" });
    expect(result.success).toBe(true);
  });

  it("accepts valid data with all fields", () => {
    const result = clientSchema.safeParse({
      name: "Juan Pérez",
      phone: "3001234567",
      email: "juan@example.com",
      notes: "Cliente frecuente",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = clientSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("El nombre es requerido");
    }
  });

  it("rejects invalid email", () => {
    const result = clientSchema.safeParse({ name: "Test", email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Email inválido");
    }
  });

  it("accepts empty string for optional fields", () => {
    const result = clientSchema.safeParse({
      name: "Test",
      phone: "",
      email: "",
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});
