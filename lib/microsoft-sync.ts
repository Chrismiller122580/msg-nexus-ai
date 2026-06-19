import { getDb, outlookConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentOutlookMessages, getValidMicrosoftToken } from '@/lib/microsoft';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function syncOutlookForUser(
  userId: number,
  limit = 25
): Promise<{ imported: number; error?: string }> {
  const accessToken = await getValidMicrosoftToken(userId);
  if (!accessToken) {
    return { imported: 0, error: 'Outlook is not connected.' };
  }

  const outlookMessages = await fetchRecentOutlookMessages(accessToken, limit);
  const db = getDb();

  const [conn] = await db
    .select({ email: outlookConnections.email })
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, userId))
    .limit(1);

  if (conn?.email) {
    await ensureConnectedAccount(userId, 'email', conn.email, 'Outlook');
  }

  const imported = await ingestMessages(
    userId,
    outlookMessages.map((m) => ({
      externalId: m.externalId,
      platformId: 'email' as const,
      from: m.from,
      body: m.body,
      subject: m.subject,
      timestamp: m.timestamp,
    })),
    'outlook'
  );

  await db
    .update(outlookConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(outlookConnections.userId, userId));

  return { imported };
}