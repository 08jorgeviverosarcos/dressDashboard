import { z } from "zod";

export const paymentSchema = z.object({
  orderId: z.string().min(1, "El pedido es requerido"),
  paymentDate: z.date(),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  paymentType: z.enum(["DOWNPAYMENT", "INSTALLMENT", "FINAL"]),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "NEQUI", "OTHER"]),
  reference: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;
