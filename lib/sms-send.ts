import { getDb, twilioConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { isTwilioSendConfigured, sendTwilioSms } from '@/lib/twilio';
import { ingestTwilioWebhookMessage } from '@/lib/twilio-sync';

export async function sendSmsForUser(
  userId: number,
  to: string,
  message: string
): Promise<{ success: true; sid: string } | { error: string }> {
  if (!isTwilioSendConfigured()) {
    return { error: 'Twilio send is not configured. Set TWILIO_PHONE_NUMBER on the server.' };
  }

  const db = getDb();
  const [conn] = await db
    .select()
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, userId))
    .limit(1);

  if (!conn) {
    return { error: 'Connect your SMS number in Settings first.' };
  }

  const body = message.trim();
  if (!body) return { error: 'Message cannot be empty.' };

  try {
    const result = await sendTwilioSms(to, body);

    await ingestTwilioWebhookMessage(userId, {
      MessageSid: result.sid || `outbound-${Date.now()}`,
      From: result.from,
      To: result.to,
      Body: body,
      DateCreated: new Date().toISOString(),
      direction: 'out',
      status: (result.status as 'sent' | 'queued') || 'sent',
    });

    return { success: true, sid: result.sid };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to send SMS' };
  }
}