import { describe, it, expect } from "vitest";
import {
  deriveStatusAfterPayment,
  canTransitionTo,
  VALID_STATUS_TRANSITIONS,
} from "./status";

describe("canTransitionTo", () => {
  describe("valid transitions", () => {
    const validCases: [string, string][] = [
      ["QUOTE", "CONFIRMED"],
      ["QUOTE", "CANCELLED"],
      ["CONFIRMED", "IN_PROGRESS"],
      ["CONFIRMED", "CANCELLED"],
      ["IN_PROGRESS", "READY"],
      ["IN_PROGRESS", "CANCELLED"],
      ["READY", "DELIVERED"],
      ["READY", "CANCELLED"],
      ["DELIVERED", "COMPLETED"],
      ["DELIVERED", "CANCELLED"],
      ["CANCELLED", "QUOTE"],
    ];

    it.each(validCases)(
      "%s → %s should be allowed",
      (from, to) => {
        expect(canTransitionTo(from as never, to as never)).toBe(true);
      }
    );
  });

  describe("invalid transitions", () => {
    const invalidCases: [string, string][] = [
      ["QUOTE", "DELIVERED"],
      ["QUOTE", "COMPLETED"],
      ["CONFIRMED", "QUOTE"],
      ["CONFIRMED", "DELIVERED"],
      ["COMPLETED", "QUOTE"],
      ["COMPLETED", "CANCELLED"],
      ["COMPLETED", "CONFIRMED"],
    ];

    it.each(invalidCases)(
      "%s → %s should be rejected",
      (from, to) => {
        expect(canTransitionTo(from as never, to as never)).toBe(false);
      }
    );
  });

  it("COMPLETED has no valid transitions (terminal state)", () => {
    expect(VALID_STATUS_TRANSITIONS.COMPLETED).toEqual([]);
  });
});

describe("deriveStatusAfterPayment", () => {
  it("returns currentStatus when totalPrice is 0", () => {
    expect(deriveStatusAfterPayment("QUOTE", 0, 30, 100)).toBe("QUOTE");
  });

  it("keeps QUOTE when paid percentage is below minimum", () => {
    // totalPrice=1000, minPct=30, paid=200 → 20% < 30%
    expect(deriveStatusAfterPayment("QUOTE", 1000, 30, 200)).toBe("QUOTE");
  });

  it("transitions QUOTE → CONFIRMED at exact minimum percentage", () => {
    // totalPrice=1000, minPct=30, paid=300 → 30% === 30%
    expect(deriveStatusAfterPayment("QUOTE", 1000, 30, 300)).toBe("CONFIRMED");
  });

  it("transitions QUOTE → CONFIRMED above minimum percentage", () => {
    // totalPrice=1000, minPct=30, paid=500 → 50% > 30%
    expect(deriveStatusAfterPayment("QUOTE", 1000, 30, 500)).toBe("CONFIRMED");
  });

  it("keeps CONFIRMED even at 100% paid (only DELIVERED transitions)", () => {
    expect(deriveStatusAfterPayment("CONFIRMED", 1000, 30, 1000)).toBe("CONFIRMED");
  });

  it("keeps DELIVERED when paid percentage is below 100%", () => {
    expect(deriveStatusAfterPayment("DELIVERED", 1000, 30, 900)).toBe("DELIVERED");
  });

  it("transitions DELIVERED → COMPLETED at exactly 100%", () => {
    expect(deriveStatusAfterPayment("DELIVERED", 1000, 30, 1000)).toBe("COMPLETED");
  });

  it("transitions DELIVERED → COMPLETED above 100%", () => {
    expect(deriveStatusAfterPayment("DELIVERED", 1000, 30, 1100)).toBe("COMPLETED");
  });

  it("handles Prisma Decimal-like objects for totalPrice and minPct", () => {
    const totalPrice = { toString: () => "1000" };
    const minPct = { toString: () => "30" };
    expect(deriveStatusAfterPayment("QUOTE", totalPrice, minPct, 300)).toBe("CONFIRMED");
  });
});
