import { getDb, whatsappConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentWhatsAppMessages, isWhatsAppConfigured } from '@/lib/whatsapp';
import { phonesMatch } from '@/lib/phone';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import type { SyncResult } from '@/lib/oauth-token';

export async function syncWhatsAppForUser(
  userId: number,
  limit = 25
): Promise<SyncResult> {
  if (!isWhatsAppConfigured()) {
    return { imported: 0, error: 'WhatsApp Business API is not configured on the server.' };
  }

  const db = getDb();
  const [conn] = await db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.userId, userId))
    .limit(1);
  if (!conn) return { imported: 0, error: 'WhatsApp is not connected.' };

  await ensureConnectedAccount(userId, 'whatsapp', conn.phoneNumber, 'WhatsApp');

  // Cloud API has no history list — inbound only via Meta webhooks.
  const messages = await fetchRecentWhatsAppMessages(conn.phoneNumber, limit);
  const imported = messages.length
    ? await ingestMessages(
        userId,
        messages.map((m) => ({ ...m, platformId: 'whatsapp' as const })),
        'whatsapp'
      )
    : 0;

  await db
    .update(whatsappConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(whatsappConnections.userId, userId));

  return {
    imported,
    info:
      imported === 0
        ? 'WhatsApp cannot pull history. New texts appear only via Meta webhook → /api/webhooks/whatsapp (verify token + subscribe to messages). Send a test message to your Business number.'
        : undefined,
  };
}

export async function ingestWhatsAppWebhookMessage(
  userId: number,
  payload: { id: string; from: string; body: string; timestamp: string }
) {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.userId, userId))
    .limit(1);
  if (!conn) return 0;

  await ensureConnectedAccount(userId, 'whatsapp', conn.phoneNumber, 'WhatsApp');

  return ingestMessages(
    userId,
    [
      {
        externalId: payload.id,
        platformId: 'whatsapp',
        from: payload.from,
        body: payload.body,
        timestamp: payload.timestamp,
      },
    ],
    'whatsapp'
  );
}

/**
 * Resolve user for inbound WhatsApp.
 * Meta sends the *customer* phone as `from`; business line is env PHONE_NUMBER_ID.
 * Route to the single connected user, or match by stored phone if multi-user.
 */
export async function findWhatsAppUserByPhone(from: string): Promise<number | null> {
  const db = getDb();
  const connections = await db.select().from(whatsappConnections);
  if (connections.length === 0) return null;
  if (connections.length === 1) return connections[0].userId;

  for (const c of connections) {
    if (phonesMatch(from, c.phoneNumber)) return c.userId;
  }

  // Multi-user, no phone match: deliver to first connected user (single business number)
  return connections[0].userId;
}
