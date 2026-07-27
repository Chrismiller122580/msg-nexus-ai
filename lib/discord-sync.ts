import { getDb, discordConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentDiscordMessages, getValidDiscordToken } from '@/lib/discord';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { syncErrorResult } from '@/lib/oauth-token';

export async function syncDiscordForUser(userId: number, limit = SYNC_BATCH_SIZE) {
  try {
    const token = await getValidDiscordToken(userId);
    if (!token) return { imported: 0, error: 'Discord is not connected.' };

    const db = getDb();
    const [conn] = await db.select().from(discordConnections).where(eq(discordConnections.userId, userId)).limit(1);
    if (conn) {
      await ensureConnectedAccount(userId, 'discord', conn.userName, 'Discord');
    }

    let messages;
    try {
      messages = await fetchRecentDiscordMessages(token, limit, conn?.lastSyncedAt ?? null);
    } catch (err) {
      if (err instanceof Error && /session expired|expired/i.test(err.message)) {
        const retried = await getValidDiscordToken(userId, { forceRefresh: true });
        if (!retried) return { imported: 0, error: 'Discord is not connected.' };
        messages = await fetchRecentDiscordMessages(retried, limit, conn?.lastSyncedAt ?? null);
      } else {
        throw err;
      }
    }

    const imported = await ingestMessages(
      userId,
      messages.map((m) => ({ ...m, platformId: 'discord' as const })),
      'discord'
    );

    await db.update(discordConnections).set({ lastSyncedAt: new Date() }).where(eq(discordConnections.userId, userId));
    return { imported };
  } catch (err) {
    return syncErrorResult(err, 'Discord sync failed');
  }
}
