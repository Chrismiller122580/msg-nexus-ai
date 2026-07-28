import { getDb, outlookConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentOutlookMessages, getValidMicrosoftToken } from '@/lib/microsoft';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { syncErrorResult, type SyncResult } from '@/lib/oauth-token';

export async function ensureOutlookConnectedAccount(userId: number, email: string) {
  await ensureConnectedAccount(userId, 'email', email, 'Outlook');
}

async function syncOneOutlookConnection(
  userId: number,
  conn: typeof outlookConnections.$inferSelect,
  limit: number
): Promise<SyncResult> {
  let accessToken = await getValidMicrosoftToken(userId, { connectionId: conn.id });
  if (!accessToken) {
    return { imported: 0, error: `Outlook ${conn.email} is not connected.` };
  }

  async function load(since: Date | null) {
    try {
      return await fetchRecentOutlookMessages(accessToken!, limit, since);
    } catch (err) {
      if (err instanceof Error && /session expired|401|expired/i.test(err.message)) {
        const retried = await getValidMicrosoftToken(userId, {
          forceRefresh: true,
          connectionId: conn.id,
        });
        if (!retried) throw err;
        accessToken = retried;
        return await fetchRecentOutlookMessages(retried, limit, since);
      }
      throw err;
    }
  }

  let outlookMessages = await load(conn.lastSyncedAt ?? null);
  let usedFullResync = false;
  if (outlookMessages.length === 0 && conn.lastSyncedAt) {
    outlookMessages = await load(null);
    usedFullResync = true;
  }

  await ensureOutlookConnectedAccount(userId, conn.email);

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
    `outlook-${conn.id}`
  );

  const db = getDb();
  await db
    .update(outlookConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(outlookConnections.id, conn.id));

  if (imported === 0 && outlookMessages.length === 0) {
    return { imported: 0, info: `No Outlook messages for ${conn.email}.` };
  }

  return {
    imported,
    info: usedFullResync ? `Full resync for ${conn.email}.` : undefined,
  };
}

export async function syncOutlookForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  try {
    const db = getDb();
    const conns = await db
      .select()
      .from(outlookConnections)
      .where(eq(outlookConnections.userId, userId));

    if (conns.length === 0) {
      return { imported: 0, error: 'Outlook is not connected.' };
    }

    let imported = 0;
    const infos: string[] = [];
    const errors: string[] = [];

    for (const conn of conns) {
      try {
        const r = await syncOneOutlookConnection(userId, conn, limit);
        imported += r.imported;
        if (r.error) errors.push(r.error);
        if (r.info) infos.push(r.info);
      } catch (err) {
        const mapped = syncErrorResult(err, `Outlook sync failed for ${conn.email}`);
        if (mapped.error) errors.push(mapped.error);
      }
    }

    if (imported === 0 && errors.length === conns.length) {
      return { imported: 0, error: errors.join(' · ') };
    }

    return {
      imported,
      info: [...infos, ...errors].filter(Boolean).join(' · ') || undefined,
      error: imported === 0 && errors.length ? errors.join(' · ') : undefined,
    };
  } catch (err) {
    return syncErrorResult(err, 'Outlook sync failed');
  }
}
