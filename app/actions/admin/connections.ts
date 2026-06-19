'use server';

import { getDb, users } from '@/db';
import {
  gmailConnections, outlookConnections, twilioConnections,
  slackConnections, discordConnections, telegramConnections,
  whatsappConnections, xConnections, connectedAccounts,
} from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { syncAllConnectors } from '@/lib/connectors/sync-all';
import { logAudit } from '@/lib/audit';

type ConnectionRow = {
  userId: number;
  email: string;
  platform: string;
  identifier: string;
  connectedAt: string;
  lastSyncedAt?: string;
};

export async function listAdminConnections() {
  await requireAdmin();
  const db = getDb();

  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const userEmail = (userId: number) =>
    allUsers.find((u: { id: number; email: string }) => u.id === userId)?.email || `user-${userId}`;

  const results: ConnectionRow[] = [];

  const gmail = await db.select().from(gmailConnections);
  for (const row of gmail) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'Gmail',
      identifier: row.email,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const outlook = await db.select().from(outlookConnections);
  for (const row of outlook) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'Outlook',
      identifier: row.email,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const twilio = await db.select().from(twilioConnections);
  for (const row of twilio) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'SMS',
      identifier: row.phoneNumber,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const slack = await db.select().from(slackConnections);
  for (const row of slack) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'Slack',
      identifier: row.userName,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const discord = await db.select().from(discordConnections);
  for (const row of discord) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'Discord',
      identifier: row.userName,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const telegram = await db.select().from(telegramConnections);
  for (const row of telegram) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'Telegram',
      identifier: row.userName,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const whatsapp = await db.select().from(whatsappConnections);
  for (const row of whatsapp) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'WhatsApp',
      identifier: row.phoneNumber,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const xRows = await db.select().from(xConnections);
  for (const row of xRows) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: 'X',
      identifier: row.userName,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString(),
    });
  }

  const simulated = await db.select().from(connectedAccounts);
  for (const row of simulated) {
    results.push({
      userId: row.userId,
      email: userEmail(row.userId),
      platform: `Simulated (${row.platformId})`,
      identifier: row.identifier,
      connectedAt: row.connectedAt.toISOString(),
    });
  }

  return results.sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
}

export async function triggerUserSyncAdminAction(userId: number) {
  const admin = await requireAdmin();
  const result = await syncAllConnectors(userId);

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'connection.sync',
    resource: 'user',
    resourceId: String(userId),
    metadata: { totalImported: result.totalImported },
  });

  return { success: true, totalImported: result.totalImported };
}