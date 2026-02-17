import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto"),
  inventoryItemId: z.string().optional().nullable(),
  quantity: z.number().int().min(1, "Cantidad mínima: 1"),
  unitPrice: z.number().min(0, "El precio debe ser positivo"),
  costSource: z.enum(["INVENTORY", "EXPENSES", "MANUAL"]).default("MANUAL"),
  costAmount: z.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
});

export const orderSchema = z.object({
  clientId: z.string().min(1, "Seleccione un cliente"),
  orderDate: z.date(),
  eventDate: z.date().optional().nullable(),
  deliveryDate: z.date().optional().nullable(),
  totalPrice: z.number().min(0, "El precio total debe ser positivo"),
  totalCost: z.number().min(0).default(0),
  minDownpaymentPct: z.number().min(0).max(100).default(30),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Agregue al menos un producto"),
});

export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
