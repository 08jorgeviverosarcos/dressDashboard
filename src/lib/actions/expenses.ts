"use server";

import { expenseSchema, type ExpenseFormData } from "@/lib/validations/expense";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { ExpenseType } from "@prisma/client";
import * as service from "@/features/expenses/expenses.service";
import { verifySession } from "@/lib/dal";
import * as auditRepo from "@/features/audit/audit.repo";

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
  const session = await verifySession();
  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.createExpense(parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Expense",
      entityId: result.data.id,
      action: "CREATED",
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/gastos");
    if (result.orderId) revalidatePath(`/pedidos/${result.orderId}`);
  }
  return { success: result.success, data: result.success ? result.data : undefined } as ActionResult<{ id: string }>;
}

export async function updateExpense(id: string, data: ExpenseFormData): Promise<ActionResult> {
  const session = await verifySession();
  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await service.updateExpense(id, parsed.data);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Expense",
      entityId: id,
      action: "UPDATED",
      userId: session.userId,
      newValue: JSON.stringify(parsed.data),
    });
    revalidatePath("/gastos");
    revalidatePath(`/gastos/${id}`);
    if (result.orderId) revalidatePath(`/pedidos/${result.orderId}`);
  }
  return { success: result.success, data: undefined } as ActionResult;
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const session = await verifySession();
  const result = await service.deleteExpense(id);
  if (result.success) {
    await auditRepo.createAuditLog({
      entity: "Expense",
      entityId: id,
      action: "DELETED",
      userId: session.userId,
    });
    revalidatePath("/gastos");
  }
  return result;
}
