import { getDb, xConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentXDMs, getValidXToken } from '@/lib/x-api';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { syncErrorResult, type SyncResult } from '@/lib/oauth-token';

export async function syncXForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  try {
    const db = getDb();
    const conns = await db.select().from(xConnections).where(eq(xConnections.userId, userId));
    if (conns.length === 0) return { imported: 0, error: 'X is not connected.' };

    let imported = 0;
    for (const conn of conns) {
      const token = await getValidXToken(userId, { connectionId: conn.id });
      if (!token) continue;

      await ensureConnectedAccount(userId, 'x', conn.userName, 'X');

      const messages = await fetchRecentXDMs(token, limit);
      imported += await ingestMessages(
        userId,
        messages.map((m) => ({ ...m, platformId: 'x' as const })),
        `x-${conn.id}`
      );

      await db
        .update(xConnections)
        .set({ lastSyncedAt: new Date() })
        .where(eq(xConnections.id, conn.id));
    }

    return { imported };
  } catch (err) {
    return syncErrorResult(err, 'X sync failed');
  }
}
