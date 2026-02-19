import { prisma } from "@/lib/prisma";
import type { ExpenseType, PaymentMethod } from "@prisma/client";

const orderItemInclude = {
  orderItem: {
    select: {
      id: true,
      product: { select: { name: true, code: true } },
      order: { select: { id: true, orderNumber: true } },
    },
  },
} as const;

export function findAll(filters?: {
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
    include: orderItemInclude,
    orderBy: { date: "desc" },
  });
}

export function findById(id: string) {
  return prisma.expense.findUnique({
    where: { id },
    include: orderItemInclude,
  });
}

export function create(data: {
  date: Date;
  category: string;
  subcategory: string | null;
  description: string;
  responsible: string | null;
  amount: number;
  expenseType: ExpenseType;
  paymentMethod: PaymentMethod;
  orderItemId: string | null;
}) {
  return prisma.expense.create({ data });
}

export function update(
  id: string,
  data: {
    date: Date;
    category: string;
    subcategory: string | null;
    description: string;
    responsible: string | null;
    amount: number;
    expenseType: ExpenseType;
    paymentMethod: PaymentMethod;
    orderItemId: string | null;
  }
) {
  return prisma.expense.update({ where: { id }, data });
}

export function deleteById(id: string) {
  return prisma.expense.delete({ where: { id } });
}

export function findOrderIdByOrderItemId(orderItemId: string) {
  return prisma.orderItem.findUnique({
    where: { id: orderItemId },
    select: { orderId: true },
  });
}
