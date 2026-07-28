import { getDb, slackConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentSlackMessages, getValidSlackToken } from '@/lib/slack';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { syncErrorResult, type SyncResult } from '@/lib/oauth-token';

export async function syncSlackForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  try {
    const db = getDb();
    const conns = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId));
    if (conns.length === 0) return { imported: 0, error: 'Slack is not connected.' };

    let imported = 0;
    for (const conn of conns) {
      let token = await getValidSlackToken(userId, { connectionId: conn.id });
      if (!token) continue;

      await ensureConnectedAccount(userId, 'slack', conn.userName, conn.teamName || 'Slack');

      let messages;
      try {
        messages = await fetchRecentSlackMessages(token, limit, conn.lastSyncedAt ?? null);
      } catch (err) {
        if (err instanceof Error && /session expired|expired|invalid_auth/i.test(err.message)) {
          const retried = await getValidSlackToken(userId, { forceRefresh: true, connectionId: conn.id });
          if (!retried) continue;
          token = retried;
          messages = await fetchRecentSlackMessages(retried, limit, conn.lastSyncedAt ?? null);
        } else {
          throw err;
        }
      }

      imported += await ingestMessages(
        userId,
        messages.map((m) => ({ ...m, platformId: 'slack' as const })),
        `slack-${conn.id}`
      );

      await db
        .update(slackConnections)
        .set({ lastSyncedAt: new Date() })
        .where(eq(slackConnections.id, conn.id));
    }

    return { imported };
  } catch (err) {
    return syncErrorResult(err, 'Slack sync failed');
  }
}
