import { getDb, twilioConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchTwilioMessagesForPhone, isTwilioConfigured } from '@/lib/twilio';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

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

  const smsMessages = await fetchTwilioMessagesForPhone(conn.phoneNumber, limit);
  await ensureConnectedAccount(userId, 'sms', conn.phoneNumber, 'Twilio SMS');

  const imported = await ingestMessages(
    userId,
    smsMessages.map((m) => ({
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
  payload: { MessageSid: string; From: string; Body: string; DateCreated?: string }
): Promise<number> {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, userId))
    .limit(1);

  if (!conn) return 0;

  await ensureConnectedAccount(userId, 'sms', conn.phoneNumber, 'Twilio SMS');

  return ingestMessages(
    userId,
    [{
      externalId: payload.MessageSid,
      platformId: 'sms',
      from: payload.From,
      body: payload.Body || '(empty SMS)',
      timestamp: payload.DateCreated || new Date().toISOString(),
    }],
    'twilio'
  );
}