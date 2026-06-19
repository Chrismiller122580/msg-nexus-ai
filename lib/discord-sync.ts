import { getDb, discordConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentDiscordMessages, getValidDiscordToken } from '@/lib/discord';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function syncDiscordForUser(userId: number, limit = 25) {
  const token = await getValidDiscordToken(userId);
  if (!token) return { imported: 0, error: 'Discord is not connected.' };

  const db = getDb();
  const [conn] = await db.select().from(discordConnections).where(eq(discordConnections.userId, userId)).limit(1);
  if (conn) {
    await ensureConnectedAccount(userId, 'discord', conn.userName, 'Discord');
  }

  const messages = await fetchRecentDiscordMessages(token, limit);
  const imported = await ingestMessages(
    userId,
    messages.map((m) => ({ ...m, platformId: 'discord' as const })),
    'discord'
  );

  await db.update(discordConnections).set({ lastSyncedAt: new Date() }).where(eq(discordConnections.userId, userId));
  return { imported };
}