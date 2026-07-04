import { getDb, twilioConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchTwilioMessagesForPhone, isTwilioConfigured } from '@/lib/twilio';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { saveSmsMessage } from '@/lib/sms-store';

export async function syncTwilioForUser(
  userId: number,
  limit = 25
): Promise<{ imported: number; error?: string }> {
  if (!isTwilioConfigured()) {
    return { imported: 0, error: 'Twilio is not configured on the server.' };
  }

  const db = getDb();
  const [conn] = await db
    .select()
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, userId))
    .limit(1);

  if (!conn) {
    return { imported: 0, error: 'SMS is not connected.' };
  }

  const fetched = await fetchTwilioMessagesForPhone(conn.phoneNumber, limit);
  await ensureConnectedAccount(userId, 'sms', conn.phoneNumber, 'Twilio SMS');

  for (const m of fetched) {
    const isOutbound = m.from === conn.phoneNumber;
    await saveSmsMessage({
      userId,
      from: m.from,
      to: isOutbound ? undefined : conn.phoneNumber,
      body: m.body,
      direction: isOutbound ? 'out' : 'in',
      status: isOutbound ? 'sent' : 'received',
      messageSid: m.externalId,
      timestamp: new Date(m.timestamp),
    });
  }

  const imported = await ingestMessages(
    userId,
    fetched.map((m) => ({
      externalId: m.externalId,
      platformId: 'sms' as const,
      from: m.from,
      body: m.body,
      timestamp: m.timestamp,
    })),
    'twilio'
  );

  await db
    .update(twilioConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(twilioConnections.userId, userId));

  return { imported };
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
  const [conn] = await db
    .select()
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, userId))
    .limit(1);

  if (!conn) return 0;

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
    [{
      externalId: payload.MessageSid,
      platformId: 'sms',
      from: payload.From,
      body: payload.Body || '(empty SMS)',
      timestamp: payload.DateCreated || ts.toISOString(),
    }],
    'twilio'
  );
}