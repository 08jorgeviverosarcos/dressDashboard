import { prisma } from "@/lib/prisma";

export async function findByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email },
  });
}

export async function findById(id: string) {
  return prisma.user.findFirst({
    where: { id },
  });
}

export async function findAll() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function create(data: {
  email: string;
  passwordHash: string;
  name: string;
  role: "ADMIN" | "SALES";
}) {
  return prisma.user.create({
    data,
  });
}

export async function deleteById(id: string) {
  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
