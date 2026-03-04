import type { Prisma } from "@prisma/client";
import type {
  DiscountType,
  InventoryTracking,
  OrderItemType,
  OrderStatus,
  ProductType,
} from "@prisma/client";

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    client: true;
    items: { include: { product: true; inventoryItem: true; expenses: true; rental: true } };
    payments: true;
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

export type ClientWithOrders = Prisma.ClientGetPayload<{
  include: { orders: true };
}>;

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CategoryProductListItem = {
  id: string;
  code: string;
  name: string;
  type: ProductType;
};

export type OrderExpenseItemSource = {
  id: string;
  name: string | null;
  product: { name: string; code: string } | null;
};

export type OrderExpenseSource = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  client: { name: string } | null;
  items: OrderExpenseItemSource[];
};

export type ClientOptionSource = {
  id: string;
  name: string;
};

export type CategoryOptionSource = {
  id: string;
  name: string;
  code: string;
};

export type ProductOptionSource = {
  id: string;
  code: string;
  name: string;
  type: ProductType;
  inventoryTracking: InventoryTracking;
  salePrice: unknown;
  rentalPrice: unknown;
  cost: unknown;
  description: string | null;
};

export type InventoryItemOptionSource = {
  id: string;
  assetCode: string | null;
  productId: string;
  status: string;
};

export type EditableOrderItemSource = {
  id: string;
  itemType: OrderItemType;
  productId: string | null;
  inventoryItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: unknown;
  discountType: DiscountType | null;
  discountValue: unknown;
  costAmount: unknown;
  rental: { returnDate: Date | null; deposit: unknown } | null;
};
