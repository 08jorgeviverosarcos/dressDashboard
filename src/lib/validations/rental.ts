import { z } from "zod";

export const rentalSchema = z.object({
  orderItemId: z.string().min(1, "El item del pedido es requerido"),
  returnDate: z.date().optional().nullable(),
  actualReturnDate: z.date().optional().nullable(),
  deposit: z.number().min(0).default(0),
});

export type RentalFormData = z.infer<typeof rentalSchema>;
