import { getDb, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentGmailMessages, getValidAccessToken } from '@/lib/gmail';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function ensureEmailConnectedAccount(userId: number, email: string) {
  await ensureConnectedAccount(userId, 'email', email, 'Gmail');
}

export async function syncGmailForUser(
  userId: number,
  limit = 25
): Promise<{ imported: number; error?: string }> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { imported: 0, error: 'Gmail is not connected.' };
  }

  const gmailMessages = await fetchRecentGmailMessages(accessToken, limit);
  const db = getDb();

  const [conn] = await db
    .select({ email: gmailConnections.email })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);

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