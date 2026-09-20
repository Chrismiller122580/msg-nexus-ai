'use server';

import { requireUser } from '@/lib/session';
import { getLatestSyncRun } from '@/lib/sync-health';
import { getDb, gmailConnections, outlookConnections } from '@/db';
import { eq } from 'drizzle-orm';

export async function getSyncHealthAction() {
  const user = await requireUser();
  const [run, gmail, outlook] = await Promise.all([
    getLatestSyncRun(user.id),
    getDb().select({ lastSyncedAt: gmailConnections.lastSyncedAt, lastError: gmailConnections.lastError, email: gmailConnections.email }).from(gmailConnections).where(eq(gmailConnections.userId, user.id)),
    getDb().select({ lastSyncedAt: outlookConnections.lastSyncedAt, lastError: outlookConnections.lastError, email: outlookConnections.email }).from(outlookConnections).where(eq(outlookConnections.userId, user.id)),
  ]);

  const reconnect = [
    ...gmail.filter((g: { lastError: string | null }) => g.lastError && /401|expired|reconnect/i.test(g.lastError)),
    ...outlook.filter((o: { lastError: string | null }) => o.lastError && /401|expired|reconnect/i.test(o.lastError)),
  ];

  return {
    lastRunAt: run?.createdAt?.toISOString() ?? null,
    lastImported: run?.imported ?? 0,
    lastErrors: run?.errors ?? null,
    lastSource: run?.source ?? null,
    reconnectNeeded: reconnect.length > 0,
    reconnectLabel: reconnect.map((r: { email: string }) => r.email).join(', ') || null,
    gmailLastSyncedAt: gmail[0]?.lastSyncedAt?.toISOString() ?? null,
  };
}
