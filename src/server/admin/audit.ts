// Every admin change writes one AuditLog row: who, what, old value, new value.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import type { Admin } from "./guard";

export async function audit(
  admin: Admin,
  entry: { action: string; entityType: string; entityId?: string; oldValue?: unknown; newValue?: unknown },
  db: Tx | typeof prisma = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      oldValue: (entry.oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (entry.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
