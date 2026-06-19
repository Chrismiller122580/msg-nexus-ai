import { getDb, slackConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentSlackMessages, getValidSlackToken } from '@/lib/slack';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function syncSlackForUser(userId: number, limit = 25) {
  const token = await getValidSlackToken(userId);
  if (!token) return { imported: 0, error: 'Slack is not connected.' };

  const db = getDb();
  const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
  if (conn) {
    await ensureConnectedAccount(userId, 'slack', conn.userName, conn.teamName || 'Slack');
  }

  const messages = await fetchRecentSlackMessages(token, limit);
  const imported = await ingestMessages(
    userId,
    messages.map((m) => ({ ...m, platformId: 'slack' as const })),
    'slack'
  );

  await db.update(slackConnections).set({ lastSyncedAt: new Date() }).where(eq(slackConnections.userId, userId));
  return { imported };
}