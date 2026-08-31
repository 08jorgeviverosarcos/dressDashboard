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

export function calculateItemSubtotal(item: {
  quantity: number;
  unitPrice: unknown;
  discountType: string | null;
  discountValue: unknown;
}): number {
  const lineTotal = item.quantity * toDecimalNumber(item.unitPrice);
  const discount = toDecimalNumber(item.discountValue);

  if (item.discountType === "FIXED") return lineTotal - discount;
  if (item.discountType === "PERCENTAGE") return lineTotal * (1 - discount / 100);
  return lineTotal;
}

export function calculateOrderBalance(order: {
  totalPrice: unknown;
  payments: { amount: unknown }[];
}): { total: number; paid: number; balance: number } {
  const total = toDecimalNumber(order.totalPrice);
  const paid = calculatePaidAmount(order.payments);
  return { total, paid, balance: total - paid };
}
