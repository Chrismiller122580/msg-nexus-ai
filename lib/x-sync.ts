import { getDb, xConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentXDMs, getValidXToken } from '@/lib/x-api';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';

export async function syncXForUser(userId: number, limit = SYNC_BATCH_SIZE) {
  const token = await getValidXToken(userId);
  if (!token) return { imported: 0, error: 'X is not connected.' };

  const db = getDb();
  const [conn] = await db.select().from(xConnections).where(eq(xConnections.userId, userId)).limit(1);
  if (conn) {
    await ensureConnectedAccount(userId, 'x', conn.userName, 'X');
  }

  const messages = await fetchRecentXDMs(token, limit);
  const imported = await ingestMessages(
    userId,
    messages.map((m) => ({ ...m, platformId: 'x' as const })),
    'x'
  );

  await db.update(xConnections).set({ lastSyncedAt: new Date() }).where(eq(xConnections.userId, userId));
  return { imported };
}