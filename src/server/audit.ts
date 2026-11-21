import type { Prisma } from "@/generated/prisma/client";

/** Records an admin action. Call inside the same transaction as the change. */
export const audit = (
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  data?: Prisma.InputJsonValue,
) => tx.auditLog.create({ data: { actorId, action, entity, entityId, data } });
