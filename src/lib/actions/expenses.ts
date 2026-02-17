"use server";

import { expenseSchema, type ExpenseFormData } from "@/lib/validations/expense";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { ExpenseType } from "@prisma/client";
import * as service from "@/features/expenses/expenses.service";

export async function getExpenses(filters?: {
  search?: string;
  category?: string;
  expenseType?: ExpenseType;
  startDate?: Date;
  endDate?: Date;
}) {
  return service.getExpenses(filters);
}

export async function getExpense(id: string) {
  return service.getExpense(id);
}

export async function createExpense(data: ExpenseFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createExpense(parsed.data);
  if (result.success) revalidatePath("/gastos");
  return result;
}

export async function updateExpense(id: string, data: ExpenseFormData): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateExpense(id, parsed.data);
  if (result.success) {
    revalidatePath("/gastos");
    revalidatePath(`/gastos/${id}`);
  }
  return result;
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const result = await service.deleteExpense(id);
  if (result.success) revalidatePath("/gastos");
  return result;
}
