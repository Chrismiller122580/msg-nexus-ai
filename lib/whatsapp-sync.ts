import { getDb, whatsappConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentWhatsAppMessages, isWhatsAppConfigured } from '@/lib/whatsapp';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function syncWhatsAppForUser(userId: number, limit = 25) {
  if (!isWhatsAppConfigured()) {
    return { imported: 0, error: 'WhatsApp Business API is not configured on the server.' };
  }

  const db = getDb();
  const [conn] = await db.select().from(whatsappConnections).where(eq(whatsappConnections.userId, userId)).limit(1);
  if (!conn) return { imported: 0, error: 'WhatsApp is not connected.' };

  await ensureConnectedAccount(userId, 'whatsapp', conn.phoneNumber, 'WhatsApp');

  const messages = await fetchRecentWhatsAppMessages(conn.phoneNumber, limit);
  const imported = messages.length
    ? await ingestMessages(
        userId,
        messages.map((m) => ({ ...m, platformId: 'whatsapp' as const })),
        'whatsapp'
      )
    : 0;

  await db.update(whatsappConnections).set({ lastSyncedAt: new Date() }).where(eq(whatsappConnections.userId, userId));
  return {
    imported,
    info: imported === 0
      ? 'WhatsApp is webhook-only — new messages arrive automatically at /api/webhooks/whatsapp.'
      : undefined,
  };
}

export async function ingestWhatsAppWebhookMessage(
  userId: number,
  payload: { id: string; from: string; body: string; timestamp: string }
) {
  const db = getDb();
  const [conn] = await db.select().from(whatsappConnections).where(eq(whatsappConnections.userId, userId)).limit(1);
  if (!conn) return 0;

  await ensureConnectedAccount(userId, 'whatsapp', conn.phoneNumber, 'WhatsApp');

  return ingestMessages(userId, [{
    externalId: payload.id,
    platformId: 'whatsapp',
    from: payload.from,
    body: payload.body,
    timestamp: payload.timestamp,
  }], 'whatsapp');
}

/** Resolve user for inbound webhook. `from` is the customer phone, not the business number. */
export async function findWhatsAppUserByPhone(_from: string): Promise<number | null> {
  const db = getDb();
  const connections = await db.select().from(whatsappConnections);
  if (connections.length === 1) return connections[0].userId;
  return null;
}