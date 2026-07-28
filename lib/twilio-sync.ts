import { getDb, twilioConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchTwilioMessagesForPhone, isTwilioConfigured } from '@/lib/twilio';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { saveSmsMessage } from '@/lib/sms-store';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import type { SyncResult } from '@/lib/oauth-token';

export async function syncTwilioForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  if (!isTwilioConfigured()) {
    return { imported: 0, error: 'Twilio is not configured on the server.' };
  }

  const db = getDb();
  const conns = await db
    .select()
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, userId));

  if (conns.length === 0) {
    return { imported: 0, error: 'SMS is not connected. Connect SMS in Settings first.' };
  }

  let imported = 0;
  const infos: string[] = [];

  for (const conn of conns) {
    const {
      messages: fetched,
      error: fetchError,
      line,
    } = await fetchTwilioMessagesForPhone(conn.phoneNumber, limit);
    if (fetchError) {
      infos.push(fetchError);
      continue;
    }

    const syncLine = line || conn.phoneNumber;
    if (line && line !== conn.phoneNumber) {
      await db
        .update(twilioConnections)
        .set({ phoneNumber: line })
        .where(eq(twilioConnections.id, conn.id));
    }

    await ensureConnectedAccount(userId, 'sms', syncLine, 'Twilio SMS');

    for (const m of fetched) {
      const isOutbound =
        m.from === syncLine || m.from.replace(/\D/g, '') === syncLine.replace(/\D/g, '');
      await saveSmsMessage({
        userId,
        from: m.from,
        to: isOutbound ? undefined : syncLine,
        body: m.body,
        direction: isOutbound ? 'out' : 'in',
        status: isOutbound ? 'sent' : 'received',
        messageSid: m.externalId,
        timestamp: new Date(m.timestamp),
      });
    }

    imported += await ingestMessages(
      userId,
      fetched.map((m) => ({
        externalId: m.externalId,
        platformId: 'sms' as const,
        from: m.from,
        body: m.body,
        timestamp: m.timestamp,
      })),
      `twilio-${conn.id}`
    );

    await db
      .update(twilioConnections)
      .set({ lastSyncedAt: new Date() })
      .where(eq(twilioConnections.id, conn.id));
  }

  if (imported === 0) {
    return {
      imported: 0,
      info:
        infos.join(' · ') ||
        'No SMS found. Send a text to your Twilio number or use Send test SMS, then Sync again.',
    };
  }

  return { imported, info: infos.join(' · ') || undefined };
}

export async function ingestTwilioWebhookMessage(
  userId: number,
  payload: {
    MessageSid: string;
    From: string;
    To?: string;
    Body: string;
    DateCreated?: string;
    direction?: 'in' | 'out';
    status?: 'received' | 'sent' | 'queued' | 'failed';
  }
): Promise<number> {
  const db = getDb();
  const conns = await db
    .select()
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, userId));

  if (conns.length === 0) return 0;

  const conn = conns[0];
  await ensureConnectedAccount(userId, 'sms', conn.phoneNumber, 'Twilio SMS');

  const direction = payload.direction ?? 'in';
  const ts = payload.DateCreated ? new Date(payload.DateCreated) : new Date();

  await saveSmsMessage({
    userId,
    from: payload.From,
    to: payload.To ?? conn.phoneNumber,
    body: payload.Body || '(empty SMS)',
    direction,
    status: payload.status ?? (direction === 'out' ? 'sent' : 'received'),
    messageSid: payload.MessageSid,
    timestamp: ts,
  });

  return ingestMessages(
    userId,
    [
      {
        externalId: payload.MessageSid,
        platformId: 'sms',
        from: payload.From,
        body: payload.Body || '(empty SMS)',
        timestamp: payload.DateCreated || ts.toISOString(),
      },
    ],
    `twilio-${conn.id}`
  );
}
