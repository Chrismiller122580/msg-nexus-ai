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
    let accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return { imported: 0, error: 'Gmail is not connected.' };
    }

    const db = getDb();

    const [conn] = await db
      .select({ email: gmailConnections.email, lastSyncedAt: gmailConnections.lastSyncedAt })
      .from(gmailConnections)
      .where(eq(gmailConnections.userId, userId))
      .limit(1);

    async function load(since: Date | null) {
      try {
        return await fetchRecentGmailMessages(accessToken!, limit, since);
      } catch (err) {
        // One force-refresh retry on expired access token
        if (err instanceof Error && /session expired|401|expired/i.test(err.message)) {
          const retried = await getValidAccessToken(userId, { forceRefresh: true });
          if (!retried) throw err;
          accessToken = retried;
          return await fetchRecentGmailMessages(retried, limit, since);
        }
        throw err;
      }
    }

    // Incremental when possible; if nothing comes back, fall back to a full recent fetch
    // so a bad/empty lastSyncedAt window does not leave the inbox stuck at 0.
    let gmailMessages = await load(conn?.lastSyncedAt ?? null);
    let usedFullResync = false;
    if (gmailMessages.length === 0 && conn?.lastSyncedAt) {
      gmailMessages = await load(null);
      usedFullResync = true;
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

    if (imported === 0 && gmailMessages.length === 0) {
      return {
        imported: 0,
        info: 'No inbox messages returned from Gmail. Confirm Gmail API is enabled and try Sync again.',
      };
    }

    if (imported === 0 && gmailMessages.length > 0) {
      return {
        imported: 0,
        info: usedFullResync
          ? 'Gmail messages already imported (no new mail).'
          : 'No new Gmail messages since last sync.',
      };
    }

    return {
      imported,
      info: usedFullResync ? 'Completed a full recent inbox resync.' : undefined,
    };
  } catch (err) {
    return syncErrorResult(err, 'Gmail sync failed');
  }
}
