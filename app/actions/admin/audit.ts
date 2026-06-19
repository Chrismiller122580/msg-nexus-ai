'use server';

import { getDb, auditLogs } from '@/db';
import { requirePermission } from '@/lib/admin';
import { desc, like, or, eq } from 'drizzle-orm';

export async function listAuditLogs(params?: { search?: string; action?: string; limit?: number }) {
  await requirePermission('audit.read');
  const db = getDb();
  const limit = params?.limit ?? 100;

  let query = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);

  if (params?.search) {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(or(
        like(auditLogs.actorEmail, `%${params.search}%`),
        like(auditLogs.action, `%${params.search}%`),
        like(auditLogs.resource, `%${params.search}%`)
      ))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    return formatAudit(rows);
  }

  if (params?.action) {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, params.action))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    return formatAudit(rows);
  }

  const rows = await query;
  return formatAudit(rows);
}

function formatAudit(rows: (typeof auditLogs.$inferSelect)[]) {
  return rows.map((a) => ({
    id: a.id,
    actorUserId: a.actorUserId,
    actorEmail: a.actorEmail,
    action: a.action,
    resource: a.resource,
    resourceId: a.resourceId,
    metadata: a.metadata,
    ipAddress: a.ipAddress,
    createdAt: a.createdAt.toISOString(),
  }));
}