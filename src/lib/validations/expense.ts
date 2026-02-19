import { z } from "zod";

export const expenseSchema = z.object({
  date: z.date(),
  category: z.string().min(1, "La categoría es requerida"),
  subcategory: z.string().optional().or(z.literal("")),
  description: z.string().min(1, "La descripción es requerida"),
  responsible: z.string().optional().or(z.literal("")),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  expenseType: z.enum(["FIXED", "VARIABLE"]),
  paymentMethod: z.enum(["BANCOLOMBIA", "NEQUI", "DAVIPLATA", "DAVIVIENDA", "BOLD_CARD", "CREDIBANCO", "CASH", "OTHER"]),
  orderItemId: z.string().optional().nullable().or(z.literal("")),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;
