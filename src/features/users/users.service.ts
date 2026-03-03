import type { ActionResult } from "@/types";
import * as repo from "./users.repo";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function validateCredentials(
  email: string,
  password: string
): Promise<
  ActionResult<{ id: string; role: "ADMIN" | "SALES"; name: string }>
> {
  const user = await repo.findByEmail(email);

  if (!user) {
    return { success: false, error: "Credenciales inválidas" };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return { success: false, error: "Credenciales inválidas" };
  }

  return {
    success: true,
    data: { id: user.id, role: user.role, name: user.name },
  };
}

export async function getUsers() {
  return repo.findAll();
}

export async function getUser(id: string) {
  return repo.findById(id);
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "SALES";
}): Promise<ActionResult<{ id: string }>> {
  const existing = await repo.findByEmail(data.email);
  if (existing) {
    return { success: false, error: "Ya existe un usuario con ese email" };
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await repo.create({
    email: data.email,
    passwordHash,
    name: data.name,
    role: data.role,
  });

  return { success: true, data: { id: user.id } };
}

export async function deleteUser(
  id: string,
  currentUserId: string
): Promise<ActionResult> {
  if (id === currentUserId) {
    return { success: false, error: "No puedes eliminar tu propio usuario" };
  }

  const user = await repo.findById(id);
  if (!user) {
    return { success: false, error: "Usuario no encontrado" };
  }

  await repo.deleteById(id);
  return { success: true, data: undefined };
}

export async function updateUser(
  id: string,
  data: {
    email: string;
    name: string;
    role: "ADMIN" | "SALES";
    password?: string;
  },
  currentUserId: string
): Promise<ActionResult> {
  const user = await repo.findById(id);
  if (!user) {
    return { success: false, error: "Usuario no encontrado" };
  }

  const existing = await repo.findByEmailExcluding(data.email, id);
  if (existing) {
    return { success: false, error: "Ya existe otro usuario con ese email" };
  }

  if (id === currentUserId && data.role !== "ADMIN") {
    return { success: false, error: "No puedes quitarte el rol de administrador" };
  }

  const updateData: {
    email: string;
    name: string;
    role: "ADMIN" | "SALES";
    passwordHash?: string;
  } = {
    email: data.email,
    name: data.name,
    role: data.role,
  };

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  }

  await repo.updateById(id, updateData);
  return { success: true, data: undefined };
}
