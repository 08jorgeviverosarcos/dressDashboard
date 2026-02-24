import { z } from "zod";

export const orderItemSchema = z.object({
  itemType: z.enum(["SALE", "RENTAL", "SERVICE"]),
  productId: z.string().optional().nullable(),
  inventoryItemId: z.string().optional().nullable(),
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional().or(z.literal("")).nullable(),
  quantity: z.number().int().min(1, "Cantidad mínima: 1"),
  unitPrice: z.number().min(0, "El precio debe ser positivo"),
  discountType: z.enum(["FIXED", "PERCENTAGE"]).optional().nullable(),
  discountValue: z.number().min(0).optional().nullable(),
  costSource: z.enum(["INVENTORY", "EXPENSES", "MANUAL"]).default("MANUAL"),
  costAmount: z.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
  rentalReturnDate: z.date().optional().nullable(),
  rentalDeposit: z.number().min(0).optional().nullable(),
}).refine(
  (data) => {
    if (data.itemType === "SALE" || data.itemType === "RENTAL") {
      return !!data.productId;
    }
    return true;
  },
  { message: "Seleccione un producto", path: ["productId"] }
);

export const orderSchema = z.object({
  orderNumber: z.number().int().min(1, "El número de pedido es requerido"),
  clientId: z.string().min(1, "Seleccione un cliente"),
  orderDate: z.date(),
  eventDate: z.date().optional().nullable(),
  deliveryDate: z.date().optional().nullable(),
  totalPrice: z.number().min(0, "El precio total debe ser positivo"),
  totalCost: z.number().min(0).default(0),
  adjustmentAmount: z.number().default(0),
  adjustmentReason: z.string().optional().or(z.literal("")),
  minDownpaymentPct: z.number().min(0).max(100).default(30),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Agregue al menos un item"),
}).refine(
  (data) => data.adjustmentAmount === 0 || !!data.adjustmentReason?.trim(),
  { message: "Ingrese el motivo del ajuste", path: ["adjustmentReason"] }
);

export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
