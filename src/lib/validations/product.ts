import { z } from "zod";

export const productSchema = z.object({
  code: z.string().min(1, "El código es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum(["RENTAL", "SALE", "BOTH"]),
  inventoryTracking: z.enum(["UNIT", "QUANTITY"]),
  categoryId: z.string().optional().nullable(),
  salePrice: z.number().min(0, "El precio debe ser positivo").optional().nullable(),
  rentalPrice: z.number().min(0, "El precio debe ser positivo").optional().nullable(),
  cost: z.number().min(0, "El costo debe ser positivo").optional().nullable(),
  description: z.string().optional().or(z.literal("")),
  imageUrl: z.string().optional().or(z.literal("")),
});

export type ProductFormData = z.infer<typeof productSchema>;
