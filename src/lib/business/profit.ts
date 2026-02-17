import { toDecimalNumber } from "@/lib/utils";

export function calculateOrderProfit(order: { status: string; totalPrice: unknown; totalCost: unknown }): number | null {
  if (order.status !== "COMPLETED") return null;
  const totalPrice = toDecimalNumber(order.totalPrice);
  const totalCost = toDecimalNumber(order.totalCost);
  return totalPrice - totalCost;
}

export function calculatePaidAmount(
  payments: { amount: unknown }[]
): number {
  return payments.reduce((sum, p) => sum + toDecimalNumber(p.amount), 0);
}

export function calculatePaidPercentage(
  payments: { amount: unknown }[],
  totalPrice: unknown
): number {
  const paid = calculatePaidAmount(payments);
  const total = toDecimalNumber(totalPrice);
  if (total === 0) return 0;
  return (paid / total) * 100;
}

export function calculateRentalProfit(
  chargedIncome: unknown,
  costs: { amount: unknown }[]
): number {
  const income = toDecimalNumber(chargedIncome);
  const totalCosts = costs.reduce((sum, c) => sum + toDecimalNumber(c.amount), 0);
  return income - totalCosts;
}
