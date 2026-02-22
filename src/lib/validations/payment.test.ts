import { describe, it, expect } from "vitest";
import { paymentSchema } from "./payment";

const validPayment = {
  orderId: "clx123abc",
  paymentDate: new Date("2026-02-22"),
  amount: 500000,
  paymentType: "DOWNPAYMENT" as const,
  paymentMethod: "NEQUI" as const,
};

describe("paymentSchema", () => {
  it("accepts valid data", () => {
    const result = paymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it("accepts all payment types", () => {
    for (const paymentType of ["DOWNPAYMENT", "INSTALLMENT", "FINAL"]) {
      const result = paymentSchema.safeParse({ ...validPayment, paymentType });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all payment methods", () => {
    const methods = ["BANCOLOMBIA", "NEQUI", "DAVIPLATA", "DAVIVIENDA", "BOLD_CARD", "CREDIBANCO", "CASH", "OTHER"];
    for (const paymentMethod of methods) {
      const result = paymentSchema.safeParse({ ...validPayment, paymentMethod });
      expect(result.success).toBe(true);
    }
  });

  it("rejects zero amount", () => {
    const result = paymentSchema.safeParse({ ...validPayment, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = paymentSchema.safeParse({ ...validPayment, amount: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects empty orderId", () => {
    const result = paymentSchema.safeParse({ ...validPayment, orderId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid paymentType", () => {
    const result = paymentSchema.safeParse({ ...validPayment, paymentType: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid paymentMethod", () => {
    const result = paymentSchema.safeParse({ ...validPayment, paymentMethod: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields as empty strings", () => {
    const result = paymentSchema.safeParse({ ...validPayment, reference: "", notes: "" });
    expect(result.success).toBe(true);
  });
});
