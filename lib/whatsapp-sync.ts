import { getDb, whatsappConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchRecentWhatsAppMessages, isWhatsAppConfigured, normalizeWhatsAppPhone } from '@/lib/whatsapp';
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
  const imported = await ingestMessages(
    userId,
    messages.map((m) => ({ ...m, platformId: 'whatsapp' as const })),
    'whatsapp'
  );

  await db.update(whatsappConnections).set({ lastSyncedAt: new Date() }).where(eq(whatsappConnections.userId, userId));
  return { imported };
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

export async function findWhatsAppUserByPhone(from: string): Promise<number | null> {
  const db = getDb();
  const normalized = normalizeWhatsAppPhone(from);
  const connections = await db.select().from(whatsappConnections);
  for (const conn of connections) {
    if (normalizeWhatsAppPhone(conn.phoneNumber) === normalized) {
      return conn.userId;
    }
  }
  if (connections.length === 1) return connections[0].userId;
  return null;
}