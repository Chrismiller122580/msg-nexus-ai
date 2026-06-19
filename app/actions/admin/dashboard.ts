'use server';

import { getDb, users, messages, subscriptions, auditLogs, connectedAccounts, apiKeys } from '@/db';
import { requirePermission } from '@/lib/admin';
import { sql, eq, gte, desc, count } from 'drizzle-orm';
import {
  gmailConnections, outlookConnections, twilioConnections,
  slackConnections, discordConnections, telegramConnections,
  whatsappConnections, xConnections,
} from '@/db/schema';

export async function getAdminDashboardStats() {
  await requirePermission('dashboard.view');
  const db = getDb();

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    adminUsers,
    totalMessages,
    messagesToday,
    signupsWeek,
    auditToday,
    freePlan,
    proPlan,
    enterprisePlan,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(eq(users.status, 'active')),
    db.select({ count: count() }).from(users).where(eq(users.status, 'suspended')),
    db.select({ count: count() }).from(users).where(eq(users.role, 'admin')),
    db.select({ count: count() }).from(messages),
    db.select({ count: count() }).from(messages).where(gte(messages.createdAt, dayAgo)),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, weekAgo)),
    db.select({ count: count() }).from(auditLogs).where(gte(auditLogs.createdAt, dayAgo)),
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.plan, 'free')),
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.plan, 'pro')),
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.plan, 'enterprise')),
  ]);

  const connectionCounts = await Promise.all([
    db.select({ count: count() }).from(gmailConnections),
    db.select({ count: count() }).from(outlookConnections),
    db.select({ count: count() }).from(twilioConnections),
    db.select({ count: count() }).from(slackConnections),
    db.select({ count: count() }).from(discordConnections),
    db.select({ count: count() }).from(telegramConnections),
    db.select({ count: count() }).from(whatsappConnections),
    db.select({ count: count() }).from(xConnections),
    db.select({ count: count() }).from(connectedAccounts),
  ]);

  const platformLabels = ['Gmail', 'Outlook', 'SMS', 'Slack', 'Discord', 'Telegram', 'WhatsApp', 'X', 'Simulated'];
  const connectionsByPlatform = platformLabels.map((label, i) => ({
    platform: label,
    count: connectionCounts[i][0]?.count ?? 0,
  }));

  const messagesByPlatform = await db
    .select({ platform: messages.platformId, count: count() })
    .from(messages)
    .groupBy(messages.platformId);

  const recentAudit = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(8);

  const activeApiKeys = await db
    .select({ count: count() })
    .from(apiKeys)
    .where(sql`${apiKeys.revokedAt} IS NULL`);

  return {
    users: {
      total: totalUsers[0]?.count ?? 0,
      active: activeUsers[0]?.count ?? 0,
      suspended: suspendedUsers[0]?.count ?? 0,
      admins: adminUsers[0]?.count ?? 0,
      signupsWeek: signupsWeek[0]?.count ?? 0,
    },
    messages: {
      total: totalMessages[0]?.count ?? 0,
      today: messagesToday[0]?.count ?? 0,
      byPlatform: messagesByPlatform.map((r: { platform: string; count: number }) => ({ platform: r.platform, count: Number(r.count) })),
    },
    subscriptions: {
      free: freePlan[0]?.count ?? 0,
      pro: proPlan[0]?.count ?? 0,
      enterprise: enterprisePlan[0]?.count ?? 0,
    },
    connections: connectionsByPlatform,
    auditEventsToday: auditToday[0]?.count ?? 0,
    activeApiKeys: activeApiKeys[0]?.count ?? 0,
    recentAudit: recentAudit.map((a: (typeof recentAudit)[number]) => ({
      id: a.id,
      action: a.action,
      resource: a.resource,
      actorEmail: a.actorEmail,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}