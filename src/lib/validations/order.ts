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
  rentalPickupDate: z.date().optional().nullable(),
  rentalReturnDate: z.date().optional().nullable(),
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
  clientId: z.string().min(1, "Seleccione un cliente"),
  orderDate: z.date(),
  eventDate: z.date().optional().nullable(),
  deliveryDate: z.date().optional().nullable(),
  totalPrice: z.number().min(0, "El precio total debe ser positivo"),
  totalCost: z.number().min(0).default(0),
  minDownpaymentPct: z.number().min(0).max(100).default(30),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Agregue al menos un item"),
});

export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
