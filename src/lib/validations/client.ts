import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  identification: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type ClientFormData = z.infer<typeof clientSchema>;
