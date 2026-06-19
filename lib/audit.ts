import { getDb, auditLogs } from '@/db';

export type AuditAction =
  | 'user.create'
  | 'user.update'
  | 'user.suspend'
  | 'user.activate'
  | 'user.promote_admin'
  | 'user.demote_admin'
  | 'subscription.create'
  | 'subscription.update'
  | 'subscription.cancel'
  | 'api_key.create'
  | 'api_key.revoke'
  | 'connection.sync'
  | 'admin.login'
  | 'settings.update';

export async function logAudit(params: {
  actorUserId?: number;
  actorEmail?: string;
  action: AuditAction | string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  const db = getDb();
  await db.insert(auditLogs).values({
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId,
    metadata: params.metadata,
    ipAddress: params.ipAddress,
  });
}