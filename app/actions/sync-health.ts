'use server';

import { requireUser } from '@/lib/session';
import { getLatestSyncRun } from '@/lib/sync-health';
import { getDb, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';

export async function getSyncHealthAction() {
  const user = await requireUser();
  const db = getDb();
  const [run, gmail] = await Promise.all([
    getLatestSyncRun(user.id),
    db
      .select({ lastSyncedAt: gmailConnections.lastSyncedAt, email: gmailConnections.email })
      .from(gmailConnections)
      .where(eq(gmailConnections.userId, user.id)),
  ]);

  const reconnectNeeded = Boolean(run?.errors && /401|expired|reconnect/i.test(run.errors));

  return {
    lastRunAt: run?.createdAt?.toISOString() ?? null,
    lastImported: run?.imported ?? 0,
    lastErrors: run?.errors ?? null,
    lastSource: run?.source ?? null,
    reconnectNeeded,
    reconnectLabel: reconnectNeeded ? gmail.map((g: { email: string }) => g.email).join(', ') : null,
    gmailLastSyncedAt: gmail[0]?.lastSyncedAt?.toISOString() ?? null,
  };
}
