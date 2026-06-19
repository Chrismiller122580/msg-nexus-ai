import { NextResponse } from 'next/server';
import { findWhatsAppUserByPhone, ingestWhatsAppWebhookMessage } from '@/lib/whatsapp-sync';

export async function POST(request: Request) {
  const body = await request.json() as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id: string;
            from: string;
            timestamp: string;
            type: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        if (msg.type !== 'text' && !msg.text?.body) continue;
        const userId = await findWhatsAppUserByPhone(msg.from);
        if (!userId) continue;

        await ingestWhatsAppWebhookMessage(userId, {
          id: msg.id,
          from: `+${msg.from}`,
          body: msg.text?.body || '(WhatsApp message)',
          timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}