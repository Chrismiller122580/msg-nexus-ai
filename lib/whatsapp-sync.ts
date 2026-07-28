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
  const conns = await db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.userId, userId));
  if (conns.length === 0) {
    return { imported: 0, error: 'WhatsApp is not connected. Connect it in Settings first.' };
  }

  let imported = 0;
  for (const conn of conns) {
    await ensureConnectedAccount(userId, 'whatsapp', conn.phoneNumber, 'WhatsApp');
    const messages = await fetchRecentWhatsAppMessages(conn.phoneNumber, limit);
    if (messages.length) {
      imported += await ingestMessages(
        userId,
        messages.map((m) => ({ ...m, platformId: 'whatsapp' as const })),
        `whatsapp-${conn.id}`
      );
    }
    await db
      .update(whatsappConnections)
      .set({ lastSyncedAt: new Date() })
      .where(eq(whatsappConnections.id, conn.id));
  }

  return {
    imported,
    info:
      imported === 0
        ? `WhatsApp has no history API (${conns.length} number${conns.length === 1 ? '' : 's'} linked). New chats arrive via Meta webhook. Text your Business number.`
        : undefined,
  };
}

export async function ingestWhatsAppWebhookMessage(
  userId: number,
  payload: { id: string; from: string; body: string; timestamp: string }
) {
  const db = getDb();
  const conns = await db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.userId, userId));
  if (conns.length === 0) return 0;

  // Prefer matching the customer phone to a stored number; else first connection
  const conn =
    conns.find((c: (typeof conns)[number]) => phonesMatch(payload.from, c.phoneNumber)) ||
    conns[0];

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
    `whatsapp-${conn.id}`
  );
}

/**
 * Resolve user for inbound WhatsApp.
 * Meta sends the *customer* phone as `from`; match stored phones, else first connection.
 */
export async function findWhatsAppUserByPhone(from: string): Promise<number | null> {
  const db = getDb();
  const connections = await db.select().from(whatsappConnections);
  if (connections.length === 0) return null;
  if (connections.length === 1) return connections[0].userId;

  for (const c of connections) {
    if (phonesMatch(from, c.phoneNumber)) return c.userId;
  }

  return connections[0].userId;
}
