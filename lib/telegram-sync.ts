import { getDb, telegramConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchTelegramUpdatesForChat } from '@/lib/telegram';
import { ensureConnectedAccount, ingestMessages } from '@/lib/connectors/ingest';
import { SYNC_BATCH_SIZE } from '@/lib/sync-constants';
import type { SyncResult } from '@/lib/oauth-token';

export async function syncTelegramForUser(
  userId: number,
  limit = SYNC_BATCH_SIZE
): Promise<SyncResult> {
  const db = getDb();
  const conns = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, userId));

  const linked = conns.filter((c: (typeof conns)[number]) => c.chatId);
  if (linked.length === 0) {
    const pending = conns.find((c: (typeof conns)[number]) => c.linkCode);
    return {
      imported: 0,
      error: pending?.linkCode
        ? 'Send the link code to the Telegram bot first.'
        : 'Telegram is not connected.',
    };
  }

  let imported = 0;
  for (const conn of linked) {
    await ensureConnectedAccount(
      userId,
      'telegram',
      conn.userName || conn.chatId!,
      'Telegram'
    );

    const messages = await fetchTelegramUpdatesForChat(conn.chatId!, limit);
    imported += await ingestMessages(
      userId,
      messages.map((m) => ({ ...m, platformId: 'telegram' as const })),
      `telegram-${conn.id}`
    );

    await db
      .update(telegramConnections)
      .set({ lastSyncedAt: new Date() })
      .where(eq(telegramConnections.id, conn.id));
  }

  return {
    imported,
    info:
      imported === 0
        ? 'Telegram uses webhooks — new messages arrive at /api/webhooks/telegram after linking.'
        : undefined,
  };
}

export async function ingestTelegramWebhookMessage(
  chatId: string,
  payload: { messageId: number; from: string; body: string; timestamp: string }
) {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.chatId, chatId))
    .limit(1);
  if (!conn) return 0;

  await ensureConnectedAccount(conn.userId, 'telegram', conn.userName || chatId, 'Telegram');

  return ingestMessages(
    conn.userId,
    [
      {
        externalId: String(payload.messageId),
        platformId: 'telegram',
        from: payload.from,
        body: payload.body,
        timestamp: payload.timestamp,
      },
    ],
    `telegram-${conn.id}`
  );
}
