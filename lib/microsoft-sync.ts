import { getDb, outlookConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentOutlookMessages, getValidMicrosoftToken } from '@/lib/microsoft';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { syncErrorResult, type SyncResult } from '@/lib/oauth-token';

export async function ensureOutlookConnectedAccount(userId: number, email: string) {
  await ensureConnectedAccount(userId, 'email', email, 'Outlook');
}

export async function syncOutlookForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  try {
    let accessToken = await getValidMicrosoftToken(userId);
    if (!accessToken) {
      return { imported: 0, error: 'Outlook is not connected.' };
    }

    const db = getDb();

    const [conn] = await db
      .select({ email: outlookConnections.email, lastSyncedAt: outlookConnections.lastSyncedAt })
      .from(outlookConnections)
      .where(eq(outlookConnections.userId, userId))
      .limit(1);

    async function load(since: Date | null) {
      try {
        return await fetchRecentOutlookMessages(accessToken!, limit, since);
      } catch (err) {
        if (err instanceof Error && /session expired|401|expired/i.test(err.message)) {
          const retried = await getValidMicrosoftToken(userId, { forceRefresh: true });
          if (!retried) throw err;
          accessToken = retried;
          return await fetchRecentOutlookMessages(retried, limit, since);
        }
        throw err;
      }
    }

    let outlookMessages = await load(conn?.lastSyncedAt ?? null);
    let usedFullResync = false;
    if (outlookMessages.length === 0 && conn?.lastSyncedAt) {
      outlookMessages = await load(null);
      usedFullResync = true;
    }

    if (conn?.email) {
      await ensureOutlookConnectedAccount(userId, conn.email);
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

    if (imported === 0 && outlookMessages.length === 0) {
      return {
        imported: 0,
        info: 'No Outlook messages returned. Confirm Mail.Read consent and try Sync again.',
      };
    }

    if (imported === 0 && outlookMessages.length > 0) {
      return {
        imported: 0,
        info: usedFullResync
          ? 'Outlook messages already imported (no new mail).'
          : 'No new Outlook messages since last sync.',
      };
    }

    return {
      imported,
      info: usedFullResync ? 'Completed a full recent inbox resync.' : undefined,
    };
  } catch (err) {
    return syncErrorResult(err, 'Outlook sync failed');
  }
}
