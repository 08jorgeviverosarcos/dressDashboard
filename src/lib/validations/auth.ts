import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "El email es requerido").email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  email: z.string().min(1, "El email es requerido").email("Email inválido"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().min(1, "El nombre es requerido"),
  role: z.enum(["ADMIN", "SALES"]),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  email: z.string().min(1, "El email es requerido").email("Email inválido"),
  name: z.string().min(1, "El nombre es requerido"),
  role: z.enum(["ADMIN", "SALES"]),
  password: z
    .union([
      z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
      z.literal(""),
    ])
    .optional(),
});

export type UpdateUserFormData = z.infer<typeof updateUserSchema>;
