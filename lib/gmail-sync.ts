import { getDb, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentGmailMessages, getValidAccessToken } from '@/lib/gmail';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function ensureEmailConnectedAccount(userId: number, email: string) {
  await ensureConnectedAccount(userId, 'email', email, 'Gmail');
}

export async function syncGmailForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<{ imported: number; error?: string }> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { imported: 0, error: 'Gmail is not connected.' };
  }

  const db = getDb();

  const [conn] = await db
    .select({ email: gmailConnections.email, lastSyncedAt: gmailConnections.lastSyncedAt })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);

  const gmailMessages = await fetchRecentGmailMessages(
    accessToken,
    limit,
    conn?.lastSyncedAt ?? null
  );

  if (conn?.email) {
    await ensureEmailConnectedAccount(userId, conn.email);
  }

  const imported = await ingestMessages(
    userId,
    gmailMessages.map((m) => ({
      externalId: m.externalId,
      platformId: 'email' as const,
      from: m.from,
      body: m.body,
      subject: m.subject,
      timestamp: m.timestamp,
    })),
    'gmail'
  );

  await db
    .update(gmailConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(gmailConnections.userId, userId));

  return { imported };
}