import { prisma } from "@/lib/prisma";

interface AuditLogData {
  entity: string;
  entityId: string;
  action: string;
  userId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
  orderId?: string | null;
  paymentId?: string | null;
}

export async function createAuditLog(data: AuditLogData) {
  return prisma.auditLog.create({
    data: {
      entity: data.entity,
      entityId: data.entityId,
      action: data.action,
      userId: data.userId ?? null,
      oldValue: data.oldValue ?? null,
      newValue: data.newValue ?? null,
      orderId: data.orderId ?? null,
      paymentId: data.paymentId ?? null,
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    },
  });
}
