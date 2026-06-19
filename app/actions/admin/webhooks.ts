'use server';

import { getDb, webhooks, webhookDeliveries } from '@/db';
import { requirePermission } from '@/lib/admin';
import { logAudit } from '@/lib/audit';
import { generateWebhookSecret, dispatchWebhookEvent } from '@/lib/webhooks';
import { WEBHOOK_EVENTS } from '@/lib/webhook-events';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function listAdminWebhooks() {
  await requirePermission('webhooks.read');
  const db = getDb();
  const rows = await db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    secretPrefix: r.secret.slice(0, 8) + '…',
    events: Array.isArray(r.events) ? r.events : [],
    enabled: r.enabled,
    lastTriggeredAt: r.lastTriggeredAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listWebhookDeliveries(webhookId?: number) {
  await requirePermission('webhooks.read');
  const db = getDb();
  const query = db.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt)).limit(50);
  const rows = webhookId
    ? await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50)
    : await query;
  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    webhookId: r.webhookId,
    event: r.event,
    status: r.status,
    responseCode: r.responseCode,
    responseBody: r.responseBody,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createWebhookAdminAction(params: {
  name: string;
  url: string;
  events: string[];
}): Promise<{ success?: boolean; error?: string; secret?: string }> {
  const admin = await requirePermission('webhooks.write');
  if (!params.name.trim()) return { error: 'Name is required' };
  if (!params.url.startsWith('https://')) return { error: 'URL must use HTTPS' };

  const secret = generateWebhookSecret();
  const db = getDb();
  await db.insert(webhooks).values({
    name: params.name.trim(),
    url: params.url.trim(),
    secret,
    events: params.events.length ? params.events : [...WEBHOOK_EVENTS],
    enabled: true,
  });

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'webhook.create',
    resource: 'webhook',
    metadata: { name: params.name, url: params.url },
  });

  revalidatePath('/admin/webhooks');
  return { success: true, secret };
}

export async function toggleWebhookAdminAction(id: number, enabled: boolean) {
  const admin = await requirePermission('webhooks.write');
  const db = getDb();
  await db.update(webhooks).set({ enabled }).where(eq(webhooks.id, id));
  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: enabled ? 'webhook.enable' : 'webhook.disable',
    resource: 'webhook',
    resourceId: String(id),
  });
  revalidatePath('/admin/webhooks');
  return { success: true };
}

export async function deleteWebhookAdminAction(id: number) {
  const admin = await requirePermission('webhooks.write');
  const db = getDb();
  await db.delete(webhooks).where(eq(webhooks.id, id));
  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'webhook.delete',
    resource: 'webhook',
    resourceId: String(id),
  });
  revalidatePath('/admin/webhooks');
  return { success: true };
}

export async function testWebhookAdminAction(id: number) {
  await requirePermission('webhooks.write');
  const db = getDb();
  const [hook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  if (!hook) return { error: 'Webhook not found' };

  await dispatchWebhookEvent('user.created', {
    test: true,
    webhookId: id,
    message: 'MsgNexus webhook test delivery',
  });

  return { success: true };
}