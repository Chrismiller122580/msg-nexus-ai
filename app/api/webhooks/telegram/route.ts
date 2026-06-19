import { NextResponse } from 'next/server';
import { linkTelegramChat } from '@/lib/telegram';
import { ingestTelegramWebhookMessage } from '@/lib/telegram-sync';

export async function POST(request: Request) {
  const body = await request.json() as {
    message?: {
      message_id: number;
      text?: string;
      date: number;
      from?: { first_name?: string; username?: string };
      chat: { id: number };
    };
  };

  const message = body.message;
  if (!message?.chat) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text?.trim() || '';
  const from = message.from?.username || message.from?.first_name || 'Telegram';

  if (text.startsWith('/link ')) {
    const code = text.replace('/link ', '').trim();
    await linkTelegramChat(code, chatId, from);
    return NextResponse.json({ ok: true });
  }

  await ingestTelegramWebhookMessage(chatId, {
    messageId: message.message_id,
    from,
    body: text || '(empty message)',
    timestamp: new Date(message.date * 1000).toISOString(),
  });

  return NextResponse.json({ ok: true });
}