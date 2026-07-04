import { getDb, outlookConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentOutlookMessages, getValidMicrosoftToken } from '@/lib/microsoft';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function syncOutlookForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<{ imported: number; error?: string }> {
  const accessToken = await getValidMicrosoftToken(userId);
  if (!accessToken) {
    return { imported: 0, error: 'Outlook is not connected.' };
  }

  const db = getDb();

  const [conn] = await db
    .select({ email: outlookConnections.email, lastSyncedAt: outlookConnections.lastSyncedAt })
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, userId))
    .limit(1);

  const outlookMessages = await fetchRecentOutlookMessages(
    accessToken,
    limit,
    conn?.lastSyncedAt ?? null
  );

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