import { getDb, telegramConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import { getAppUrl } from '@/lib/app-url';

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function getTelegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

export function generateTelegramLinkCode(): string {
  return generateId().slice(0, 8).toUpperCase();
}

export async function ensureTelegramWebhook(): Promise<{ ok: boolean; error?: string }> {
  const token = getTelegramBotToken();
  if (!token) return { ok: false, error: 'Telegram bot token not configured' };

  const webhookUrl = `${getAppUrl()}/api/webhooks/telegram`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
  });
  const data = await res.json() as { ok: boolean; description?: string };
  if (!data.ok) return { ok: false, error: data.description || 'setWebhook failed' };
  return { ok: true };
}

export async function createTelegramLinkCode(userId: number): Promise<string> {
  const db = getDb();
  const code = generateTelegramLinkCode();
  const existing = await db.select().from(telegramConnections).where(eq(telegramConnections.userId, userId)).limit(1);

  if (existing.length > 0) {
    await db.update(telegramConnections).set({ linkCode: code }).where(eq(telegramConnections.userId, userId));
  } else {
    await db.insert(telegramConnections).values({ userId, linkCode: code });
  }
  return code;
}

export async function linkTelegramChat(linkCode: string, chatId: string, userName?: string) {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.linkCode, linkCode.toUpperCase()))
    .limit(1);

  if (!conn) return false;

  await db.update(telegramConnections).set({
    chatId,
    userName: userName || chatId,
    linkCode: null,
  }).where(eq(telegramConnections.userId, conn.userId));

  return true;
}

export async function fetchTelegramUpdatesForChat(chatId: string, limit = 25) {
  const token = getTelegramBotToken();
  if (!token) return [];

  // Webhook mode: getUpdates returns empty once setWebhook is active
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
  if (!res.ok) return [];

  const data = await res.json() as {
    ok: boolean;
    result?: Array<{
      update_id: number;
      message?: {
        message_id: number;
        date: number;
        text?: string;
        from?: { first_name?: string; username?: string };
        chat: { id: number };
      };
    }>;
  };

  if (!data.ok || !data.result) return [];

  return data.result
    .filter((u) => u.message && String(u.message.chat.id) === chatId)
    .map((u) => {
      const m = u.message!;
      const from = m.from?.username || m.from?.first_name || 'Telegram';
      return {
        externalId: String(m.message_id),
        from,
        body: m.text || '(empty message)',
        timestamp: new Date(m.date * 1000).toISOString(),
      };
    })
    .slice(-limit);
}