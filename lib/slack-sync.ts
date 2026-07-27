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
    const token = await getValidSlackToken(userId);
    if (!token) return { imported: 0, error: 'Slack is not connected.' };

    const db = getDb();
    const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
    if (conn) {
      await ensureConnectedAccount(userId, 'slack', conn.userName, conn.teamName || 'Slack');
    }

    let messages;
    try {
      messages = await fetchRecentSlackMessages(token, limit, conn?.lastSyncedAt ?? null);
    } catch (err) {
      if (err instanceof Error && /session expired|expired|invalid_auth/i.test(err.message)) {
        const retried = await getValidSlackToken(userId, { forceRefresh: true });
        if (!retried) return { imported: 0, error: 'Slack is not connected.' };
        messages = await fetchRecentSlackMessages(retried, limit, conn?.lastSyncedAt ?? null);
      } else {
        throw err;
      }
    }

    const imported = await ingestMessages(
      userId,
      messages.map((m) => ({ ...m, platformId: 'slack' as const })),
      'slack'
    );

    await db.update(slackConnections).set({ lastSyncedAt: new Date() }).where(eq(slackConnections.userId, userId));
    return { imported };
  } catch (err) {
    return syncErrorResult(err, 'Slack sync failed');
  }
}
