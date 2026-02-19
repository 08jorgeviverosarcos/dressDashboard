import type { Prisma } from "@prisma/client";

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    client: true;
    items: { include: { product: true; inventoryItem: true; expenses: true } };
    payments: true;
    rental: { include: { costs: true } };
    auditLogs: true;
  };
}>;

export type OrderWithClient = Prisma.OrderGetPayload<{
  include: { client: true; payments: true };
}>;

export type OrderItemWithProduct = Prisma.OrderItemGetPayload<{
  include: { product: true; inventoryItem: true; expenses: true };
}>;

export type ProductWithInventory = Prisma.ProductGetPayload<{
  include: { inventoryItems: true };
}>;

export type RentalWithCosts = Prisma.RentalGetPayload<{
  include: { costs: true; order: { include: { client: true } } };
}>;

export type ClientWithOrders = Prisma.ClientGetPayload<{
  include: { orders: true };
}>;

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
