import type { ActionResult } from "@/types";
import type { ExpenseFormData } from "@/lib/validations/expense";
import * as repo from "./expenses.repo";

type CreateExpenseResult =
  | { success: true; data: { id: string }; orderId?: string }
  | { success: false; error: string };

type UpdateExpenseResult =
  | { success: true; data: undefined; orderId?: string }
  | { success: false; error: string };

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
): Promise<CreateExpenseResult> {
  const orderItemId = parsed.orderItemId || null;

  const expense = await repo.create({
    date: parsed.date,
    category: parsed.category,
    subcategory: parsed.subcategory || null,
    description: parsed.description,
    responsible: parsed.responsible || null,
    amount: parsed.amount,
    expenseType: parsed.expenseType,
    paymentMethod: parsed.paymentMethod,
    orderItemId,
  });

  let orderId: string | undefined;
  if (orderItemId) {
    const orderItem = await repo.findOrderIdByOrderItemId(orderItemId);
    orderId = orderItem?.orderId ?? undefined;
  }

  return { success: true, data: { id: expense.id }, orderId };
}

export async function updateExpense(
  id: string,
  parsed: ExpenseFormData
): Promise<UpdateExpenseResult> {
  const orderItemId = parsed.orderItemId || null;

  await repo.update(id, {
    date: parsed.date,
    category: parsed.category,
    subcategory: parsed.subcategory || null,
    description: parsed.description,
    responsible: parsed.responsible || null,
    amount: parsed.amount,
    expenseType: parsed.expenseType,
    paymentMethod: parsed.paymentMethod,
    orderItemId,
  });

  let orderId: string | undefined;
  if (orderItemId) {
    const orderItem = await repo.findOrderIdByOrderItemId(orderItemId);
    orderId = orderItem?.orderId ?? undefined;
  }

  return { success: true, data: undefined, orderId };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await repo.deleteById(id);
  return { success: true, data: undefined };
}
