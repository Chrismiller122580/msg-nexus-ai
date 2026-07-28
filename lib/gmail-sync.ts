import { getDb, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentGmailMessages, getValidAccessToken } from '@/lib/gmail';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { syncErrorResult, type SyncResult } from '@/lib/oauth-token';

export async function ensureEmailConnectedAccount(userId: number, email: string) {
  await ensureConnectedAccount(userId, 'email', email, 'Gmail');
}

async function syncOneGmailConnection(
  userId: number,
  conn: typeof gmailConnections.$inferSelect,
  limit: number
): Promise<SyncResult> {
  let accessToken = await getValidAccessToken(userId, { connectionId: conn.id });
  if (!accessToken) {
    return { imported: 0, error: `Gmail ${conn.email} is not connected.` };
  }

  async function load(since: Date | null) {
    try {
      return await fetchRecentGmailMessages(accessToken!, limit, since);
    } catch (err) {
      if (err instanceof Error && /session expired|401|expired/i.test(err.message)) {
        const retried = await getValidAccessToken(userId, {
          forceRefresh: true,
          connectionId: conn.id,
        });
        if (!retried) throw err;
        accessToken = retried;
        return await fetchRecentGmailMessages(retried, limit, since);
      }
      throw err;
    }
  }

  let gmailMessages = await load(conn.lastSyncedAt ?? null);
  let usedFullResync = false;
  if (gmailMessages.length === 0 && conn.lastSyncedAt) {
    gmailMessages = await load(null);
    usedFullResync = true;
  }

  await ensureEmailConnectedAccount(userId, conn.email);

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
    `gmail-${conn.id}`
  );

  const db = getDb();
  await db
    .update(gmailConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(gmailConnections.id, conn.id));

  if (imported === 0 && gmailMessages.length === 0) {
    return {
      imported: 0,
      info: `No inbox messages for ${conn.email}.`,
    };
  }

  return {
    imported,
    info: usedFullResync ? `Full resync for ${conn.email}.` : undefined,
  };
}

export async function syncGmailForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  try {
    const db = getDb();
    const conns = await db
      .select()
      .from(gmailConnections)
      .where(eq(gmailConnections.userId, userId));

    if (conns.length === 0) {
      return { imported: 0, error: 'Gmail is not connected.' };
    }

    let imported = 0;
    const infos: string[] = [];
    const errors: string[] = [];

    for (const conn of conns) {
      try {
        const r = await syncOneGmailConnection(userId, conn, limit);
        imported += r.imported;
        if (r.error) errors.push(r.error);
        if (r.info) infos.push(r.info);
      } catch (err) {
        const mapped = syncErrorResult(err, `Gmail sync failed for ${conn.email}`);
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
    return syncErrorResult(err, 'Gmail sync failed');
  }
}
