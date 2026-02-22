import { describe, it, expect } from "vitest";
import { orderItemSchema, orderSchema } from "./order";

const validItem = {
  itemType: "SALE" as const,
  productId: "prod-001",
  name: "Vestido Rojo",
  quantity: 1,
  unitPrice: 500000,
};

const validOrder = {
  orderNumber: 1,
  clientId: "client-001",
  orderDate: new Date("2026-02-22"),
  totalPrice: 500000,
  items: [validItem],
};

describe("orderItemSchema", () => {
  it("accepts valid SALE item with productId", () => {
    const result = orderItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it("accepts valid RENTAL item with productId", () => {
    const result = orderItemSchema.safeParse({ ...validItem, itemType: "RENTAL" });
    expect(result.success).toBe(true);
  });

  it("accepts SERVICE item without productId", () => {
    const result = orderItemSchema.safeParse({
      itemType: "SERVICE",
      name: "Ajuste",
      quantity: 1,
      unitPrice: 50000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects SALE item without productId (refinement)", () => {
    const result = orderItemSchema.safeParse({
      itemType: "SALE",
      name: "Vestido",
      quantity: 1,
      unitPrice: 500000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const productIdError = result.error.issues.find((i) => i.path.includes("productId"));
      expect(productIdError?.message).toBe("Seleccione un producto");
    }
  });

  it("rejects RENTAL item without productId (refinement)", () => {
    const result = orderItemSchema.safeParse({
      itemType: "RENTAL",
      name: "Vestido",
      quantity: 1,
      unitPrice: 300000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const productIdError = result.error.issues.find((i) => i.path.includes("productId"));
      expect(productIdError?.message).toBe("Seleccione un producto");
    }
  });

  it("rejects SALE item with null productId (refinement)", () => {
    const result = orderItemSchema.safeParse({
      itemType: "SALE",
      productId: null,
      name: "Vestido",
      quantity: 1,
      unitPrice: 500000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects quantity = 0", () => {
    const result = orderItemSchema.safeParse({ ...validItem, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative unitPrice", () => {
    const result = orderItemSchema.safeParse({ ...validItem, unitPrice: -100 });
    expect(result.success).toBe(false);
  });

  it("defaults costSource to MANUAL", () => {
    const result = orderItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.costSource).toBe("MANUAL");
    }
  });

  it("defaults costAmount to 0", () => {
    const result = orderItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.costAmount).toBe(0);
    }
  });

  it("accepts discount fields", () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      discountType: "PERCENTAGE",
      discountValue: 10,
    });
    expect(result.success).toBe(true);
  });
});

describe("orderSchema", () => {
  it("accepts valid order with one item", () => {
    const result = orderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = orderSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const itemsError = result.error.issues.find((i) => i.path.includes("items"));
      expect(itemsError?.message).toBe("Agregue al menos un item");
    }
  });

  it("requires adjustmentReason when adjustmentAmount is not 0 (refinement)", () => {
    const result = orderSchema.safeParse({
      ...validOrder,
      adjustmentAmount: 50000,
      adjustmentReason: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const reasonError = result.error.issues.find((i) => i.path.includes("adjustmentReason"));
      expect(reasonError?.message).toBe("Ingrese el motivo del ajuste");
    }
  });

  it("accepts adjustmentAmount with adjustmentReason", () => {
    const result = orderSchema.safeParse({
      ...validOrder,
      adjustmentAmount: 50000,
      adjustmentReason: "Descuento especial",
    });
    expect(result.success).toBe(true);
  });

  it("does not require adjustmentReason when adjustmentAmount is 0", () => {
    const result = orderSchema.safeParse({
      ...validOrder,
      adjustmentAmount: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects orderNumber = 0", () => {
    const result = orderSchema.safeParse({ ...validOrder, orderNumber: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects empty clientId", () => {
    const result = orderSchema.safeParse({ ...validOrder, clientId: "" });
    expect(result.success).toBe(false);
  });

  it("defaults minDownpaymentPct to 30", () => {
    const result = orderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minDownpaymentPct).toBe(30);
    }
  });

  it("rejects minDownpaymentPct over 100", () => {
    const result = orderSchema.safeParse({ ...validOrder, minDownpaymentPct: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects negative totalPrice", () => {
    const result = orderSchema.safeParse({ ...validOrder, totalPrice: -1000 });
    expect(result.success).toBe(false);
  });
});
