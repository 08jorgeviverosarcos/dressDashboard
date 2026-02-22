import { describe, it, expect } from "vitest";
import {
  calculateOrderProfit,
  calculatePaidAmount,
  calculatePaidPercentage,
} from "./profit";

describe("calculateOrderProfit", () => {
  it("returns null for non-COMPLETED orders", () => {
    expect(calculateOrderProfit({ status: "QUOTE", totalPrice: 1000, totalCost: 600 })).toBeNull();
    expect(calculateOrderProfit({ status: "CONFIRMED", totalPrice: 1000, totalCost: 600 })).toBeNull();
    expect(calculateOrderProfit({ status: "DELIVERED", totalPrice: 1000, totalCost: 600 })).toBeNull();
  });

  it("returns profit for COMPLETED orders", () => {
    expect(calculateOrderProfit({ status: "COMPLETED", totalPrice: 1000, totalCost: 600 })).toBe(400);
  });

  it("handles Prisma Decimal-like objects", () => {
    const order = {
      status: "COMPLETED",
      totalPrice: { toString: () => "1500000" },
      totalCost: { toString: () => "800000" },
    };
    expect(calculateOrderProfit(order)).toBe(700000);
  });

  it("returns negative profit (loss) when cost exceeds price", () => {
    expect(calculateOrderProfit({ status: "COMPLETED", totalPrice: 500, totalCost: 800 })).toBe(-300);
  });

  it("returns 0 when price equals cost", () => {
    expect(calculateOrderProfit({ status: "COMPLETED", totalPrice: 1000, totalCost: 1000 })).toBe(0);
  });
});

describe("calculatePaidAmount", () => {
  it("returns 0 for empty payments array", () => {
    expect(calculatePaidAmount([])).toBe(0);
  });

  it("returns the amount for a single payment", () => {
    expect(calculatePaidAmount([{ amount: 500 }])).toBe(500);
  });

  it("sums multiple payments", () => {
    const payments = [{ amount: 300 }, { amount: 200 }, { amount: 100 }];
    expect(calculatePaidAmount(payments)).toBe(600);
  });

  it("handles Prisma Decimal-like amounts", () => {
    const payments = [
      { amount: { toString: () => "1000" } },
      { amount: { toString: () => "500.50" } },
    ];
    expect(calculatePaidAmount(payments)).toBe(1500.5);
  });
});

describe("calculatePaidPercentage", () => {
  it("returns 0 when totalPrice is 0", () => {
    expect(calculatePaidPercentage([{ amount: 100 }], 0)).toBe(0);
  });

  it("returns 0 with no payments", () => {
    expect(calculatePaidPercentage([], 1000)).toBe(0);
  });

  it("calculates correct percentage for partial payment", () => {
    expect(calculatePaidPercentage([{ amount: 500 }], 1000)).toBe(50);
  });

  it("returns 100 for fully paid", () => {
    expect(calculatePaidPercentage([{ amount: 1000 }], 1000)).toBe(100);
  });

  it("returns over 100 for overpayment", () => {
    expect(calculatePaidPercentage([{ amount: 1200 }], 1000)).toBe(120);
  });
});
