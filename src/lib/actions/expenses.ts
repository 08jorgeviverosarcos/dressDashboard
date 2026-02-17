"use server";

import { prisma } from "@/lib/prisma";
import { expenseSchema, type ExpenseFormData } from "@/lib/validations/expense";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { ExpenseType } from "@prisma/client";

export async function getExpenses(filters?: {
  search?: string;
  category?: string;
  expenseType?: ExpenseType;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.category) where.category = filters.category;
  if (filters?.expenseType) where.expenseType = filters.expenseType;
  if (filters?.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { category: { contains: filters.search, mode: "insensitive" } },
      { subcategory: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters?.startDate || filters?.endDate) {
    where.date = {
      ...(filters.startDate && { gte: filters.startDate }),
      ...(filters.endDate && { lte: filters.endDate }),
    };
  }

  return prisma.expense.findMany({
    where,
    include: { order: { select: { id: true, orderNumber: true } } },
    orderBy: { date: "desc" },
  });
}

export async function getExpense(id: string) {
  return prisma.expense.findUnique({
    where: { id },
    include: { order: { select: { id: true, orderNumber: true } } },
  });
}

export async function createExpense(data: ExpenseFormData): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const expense = await prisma.expense.create({
    data: {
      date: parsed.data.date,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory || null,
      description: parsed.data.description,
      responsible: parsed.data.responsible || null,
      amount: parsed.data.amount,
      expenseType: parsed.data.expenseType,
      paymentMethod: parsed.data.paymentMethod,
      orderId: parsed.data.orderId || null,
    },
  });

  revalidatePath("/gastos");
  return { success: true, data: { id: expense.id } };
}

export async function updateExpense(id: string, data: ExpenseFormData): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await prisma.expense.update({
    where: { id },
    data: {
      date: parsed.data.date,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory || null,
      description: parsed.data.description,
      responsible: parsed.data.responsible || null,
      amount: parsed.data.amount,
      expenseType: parsed.data.expenseType,
      paymentMethod: parsed.data.paymentMethod,
      orderId: parsed.data.orderId || null,
    },
  });

  revalidatePath("/gastos");
  revalidatePath(`/gastos/${id}`);
  return { success: true, data: undefined };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/gastos");
  return { success: true, data: undefined };
}
