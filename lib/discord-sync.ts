import { getDb, discordConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentDiscordMessages, getValidDiscordToken } from '@/lib/discord';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { syncErrorResult, type SyncResult } from '@/lib/oauth-token';

export async function syncDiscordForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  try {
    const db = getDb();
    const conns = await db
      .select()
      .from(discordConnections)
      .where(eq(discordConnections.userId, userId));
    if (conns.length === 0) return { imported: 0, error: 'Discord is not connected.' };

    let imported = 0;
    for (const conn of conns) {
      let token = await getValidDiscordToken(userId, { connectionId: conn.id });
      if (!token) continue;

      await ensureConnectedAccount(userId, 'discord', conn.userName, 'Discord');

      let messages;
      try {
        messages = await fetchRecentDiscordMessages(token, limit, conn.lastSyncedAt ?? null);
      } catch (err) {
        if (err instanceof Error && /session expired|expired/i.test(err.message)) {
          const retried = await getValidDiscordToken(userId, {
            forceRefresh: true,
            connectionId: conn.id,
          });
          if (!retried) continue;
          token = retried;
          messages = await fetchRecentDiscordMessages(retried, limit, conn.lastSyncedAt ?? null);
        } else {
          throw err;
        }
      }

      imported += await ingestMessages(
        userId,
        messages.map((m) => ({ ...m, platformId: 'discord' as const })),
        `discord-${conn.id}`
      );

      await db
        .update(discordConnections)
        .set({ lastSyncedAt: new Date() })
        .where(eq(discordConnections.id, conn.id));
    }

    return { imported };
  } catch (err) {
    return syncErrorResult(err, 'Discord sync failed');
  }
}
