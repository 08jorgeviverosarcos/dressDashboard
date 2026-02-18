import type { ActionResult } from "@/types";
import type { ExpenseFormData } from "@/lib/validations/expense";
import * as repo from "./expenses.repo";

export function getExpenses(filters?: {
  search?: string;
  category?: string;
  expenseType?: "FIXED" | "VARIABLE";
  startDate?: Date;
  endDate?: Date;
}) {
  return repo.findAll(filters);
}

export function getExpense(id: string) {
  return repo.findById(id);
}

export async function createExpense(
  parsed: ExpenseFormData
): Promise<ActionResult<{ id: string }>> {
  const expense = await repo.create({
    date: parsed.date,
    category: parsed.category,
    subcategory: parsed.subcategory || null,
    description: parsed.description,
    responsible: parsed.responsible || null,
    amount: parsed.amount,
    expenseType: parsed.expenseType,
    paymentMethod: parsed.paymentMethod,
    orderId: parsed.orderId || null,
  });

  return { success: true, data: { id: expense.id } };
}

export async function updateExpense(
  id: string,
  parsed: ExpenseFormData
): Promise<ActionResult> {
  await repo.update(id, {
    date: parsed.date,
    category: parsed.category,
    subcategory: parsed.subcategory || null,
    description: parsed.description,
    responsible: parsed.responsible || null,
    amount: parsed.amount,
    expenseType: parsed.expenseType,
    paymentMethod: parsed.paymentMethod,
    orderId: parsed.orderId || null,
  });

  return { success: true, data: undefined };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await repo.deleteById(id);
  return { success: true, data: undefined };
}
