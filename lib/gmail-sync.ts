import { getDb, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentGmailMessages, getValidAccessToken } from '@/lib/gmail';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { syncErrorResult, type SyncResult } from '@/lib/oauth-token';

export async function ensureEmailConnectedAccount(userId: number, email: string) {
  await ensureConnectedAccount(userId, 'email', email, 'Gmail');
}

export async function syncGmailForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  try {
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

    let gmailMessages;
    try {
      gmailMessages = await fetchRecentGmailMessages(
        accessToken,
        limit,
        conn?.lastSyncedAt ?? null
      );
    } catch (err) {
      // One force-refresh retry on expired access token
      if (err instanceof Error && /session expired|401|expired/i.test(err.message)) {
        const retried = await getValidAccessToken(userId, { forceRefresh: true });
        if (!retried) return { imported: 0, error: 'Gmail is not connected.' };
        gmailMessages = await fetchRecentGmailMessages(
          retried,
          limit,
          conn?.lastSyncedAt ?? null
        );
      } else {
        throw err;
      }
    }

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
  } catch (err) {
    return syncErrorResult(err, 'Gmail sync failed');
  }
}
