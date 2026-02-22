import { describe, it, expect } from "vitest";
import {
  toDecimalNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "./utils";

describe("toDecimalNumber", () => {
  it("returns 0 for null", () => {
    expect(toDecimalNumber(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(toDecimalNumber(undefined)).toBe(0);
  });

  it("returns 0 for zero", () => {
    expect(toDecimalNumber(0)).toBe(0);
  });

  it("returns the number directly when given a number", () => {
    expect(toDecimalNumber(1500.5)).toBe(1500.5);
  });

  it("parses numeric strings", () => {
    expect(toDecimalNumber("1500.50")).toBe(1500.5);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(toDecimalNumber("abc")).toBe(0);
  });

  it("handles objects with toString (Prisma Decimal)", () => {
    const decimal = { toString: () => "250.00" };
    expect(toDecimalNumber(decimal)).toBe(250);
  });
});

describe("formatCurrency", () => {
  it("returns $0 for null", () => {
    expect(formatCurrency(null)).toBe("$0");
  });

  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("formats integer amounts with COP format", () => {
    const result = formatCurrency(1500000);
    expect(result).toContain("1.500.000");
  });

  it("formats string numbers", () => {
    const result = formatCurrency("250000");
    expect(result).toContain("250.000");
  });

  it("formats negative numbers", () => {
    const result = formatCurrency(-5000);
    expect(result).toContain("5.000");
  });
});

describe("formatDate", () => {
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date(2026, 1, 22)); // Feb 22, 2026
    expect(result).toBe("22/02/2026");
  });

  it("formats an ISO string", () => {
    const result = formatDate("2026-03-15T10:00:00");
    expect(result).toBe("15/03/2026");
  });
});

describe("formatDateTime", () => {
  it("returns empty string for null", () => {
    expect(formatDateTime(null)).toBe("");
  });

  it("formats a Date object with time", () => {
    const result = formatDateTime(new Date(2026, 1, 22, 14, 30));
    expect(result).toBe("22/02/2026 14:30");
  });

  it("formats an ISO string with time", () => {
    const result = formatDateTime("2026-03-15T10:45:00");
    expect(result).toContain("15/03/2026");
    expect(result).toContain("10:45");
  });
});
