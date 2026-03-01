import { prisma } from "@/lib/prisma";

export async function createAuditLog(data: {
  entity: string;
  entityId: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      entity: data.entity,
      entityId: data.entityId,
      action: data.action,
      oldValue: data.oldValue ?? null,
      newValue: data.newValue ?? null,
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    },
  });
}
