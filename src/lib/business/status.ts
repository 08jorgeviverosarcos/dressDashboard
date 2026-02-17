import { OrderStatus } from "@prisma/client";
import { toDecimalNumber } from "@/lib/utils";

export function deriveStatusAfterPayment(
  currentStatus: OrderStatus,
  totalPrice: unknown,
  minDownpaymentPct: unknown,
  newTotalPaid: number
): OrderStatus {
  const total = toDecimalNumber(totalPrice);
  if (total === 0) return currentStatus;

  const paidPct = (newTotalPaid / total) * 100;
  const minPct = toDecimalNumber(minDownpaymentPct);

  if (currentStatus === "QUOTE" && paidPct >= minPct) {
    return "CONFIRMED";
  }

  if (paidPct >= 100 && currentStatus === "DELIVERED") {
    return "COMPLETED";
  }

  return currentStatus;
}

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  QUOTE: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["QUOTE"],
};

export function canTransitionTo(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}
