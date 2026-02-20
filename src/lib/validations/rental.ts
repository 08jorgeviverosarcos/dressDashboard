import { z } from "zod";

export const rentalSchema = z.object({
  orderItemId: z.string().min(1, "El item del pedido es requerido"),
  returnDate: z.date().optional().nullable(),
  actualReturnDate: z.date().optional().nullable(),
  deposit: z.number().min(0).default(0),
});

export const rentalCostSchema = z.object({
  rentalId: z.string().min(1, "El alquiler es requerido"),
  type: z.string().min(1, "El tipo de costo es requerido"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  description: z.string().optional().or(z.literal("")),
});

export type RentalFormData = z.infer<typeof rentalSchema>;
export type RentalCostFormData = z.infer<typeof rentalCostSchema>;
