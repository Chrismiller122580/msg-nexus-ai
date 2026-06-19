import { getDb, telegramConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchTelegramUpdatesForChat } from '@/lib/telegram';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';

export async function syncTelegramForUser(userId: number, limit = 25) {
  const db = getDb();
  const [conn] = await db.select().from(telegramConnections).where(eq(telegramConnections.userId, userId)).limit(1);

  if (!conn?.chatId) {
    return { imported: 0, error: conn?.linkCode ? 'Send the link code to the Telegram bot first.' : 'Telegram is not connected.' };
  }

  await ensureConnectedAccount(userId, 'telegram', conn.userName || conn.chatId, 'Telegram');

  const messages = await fetchTelegramUpdatesForChat(conn.chatId, limit);
  const imported = await ingestMessages(
    userId,
    messages.map((m) => ({ ...m, platformId: 'telegram' as const })),
    'telegram'
  );

  await db.update(telegramConnections).set({ lastSyncedAt: new Date() }).where(eq(telegramConnections.userId, userId));
  return { imported };
}

export async function ingestTelegramWebhookMessage(
  chatId: string,
  payload: { messageId: number; from: string; body: string; timestamp: string }
) {
  const db = getDb();
  const [conn] = await db.select().from(telegramConnections).where(eq(telegramConnections.chatId, chatId)).limit(1);
  if (!conn) return 0;

  await ensureConnectedAccount(conn.userId, 'telegram', conn.userName || chatId, 'Telegram');

  return ingestMessages(conn.userId, [{
    externalId: String(payload.messageId),
    platformId: 'telegram',
    from: payload.from,
    body: payload.body,
    timestamp: payload.timestamp,
  }], 'telegram');
}