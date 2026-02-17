"use client";

import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, INVENTORY_STATUS_LABELS } from "@/lib/constants/categories";

const statusColors: Record<string, string> = {
  QUOTE: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  CONFIRMED: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  READY: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  DELIVERED: "bg-green-100 text-green-800 hover:bg-green-100",
  COMPLETED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  CANCELLED: "bg-red-100 text-red-800 hover:bg-red-100",
  AVAILABLE: "bg-green-100 text-green-800 hover:bg-green-100",
  RENTED: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  SOLD: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  IN_REPAIR: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  RETIRED: "bg-red-100 text-red-800 hover:bg-red-100",
};

interface StatusBadgeProps {
  status: string;
  type?: "order" | "inventory";
}

export function StatusBadge({ status, type = "order" }: StatusBadgeProps) {
  const labels = type === "order" ? ORDER_STATUS_LABELS : INVENTORY_STATUS_LABELS;
  const label = labels[status] ?? status;
  const colorClass = statusColors[status] ?? "bg-gray-100 text-gray-800";

  return (
    <Badge variant="secondary" className={colorClass}>
      {label}
    </Badge>
  );
}
