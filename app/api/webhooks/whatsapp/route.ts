import { NextResponse } from 'next/server';
import { findWhatsAppUserByPhone, ingestWhatsAppWebhookMessage } from '@/lib/whatsapp-sync';

type WaMessage = {
  id: string;
  from: string;
  timestamp: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
};

function extractBody(msg: WaMessage): string | null {
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg.type && msg.type !== 'text') return `(WhatsApp ${msg.type})`;
  return null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: WaMessage[];
          metadata?: { display_phone_number?: string; phone_number_id?: string };
        };
      }>;
    }>;
  };

  let ingested = 0;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        const text = extractBody(msg);
        if (!text) continue;

        const userId = await findWhatsAppUserByPhone(msg.from);
        if (!userId) {
          console.warn(
            '[whatsapp-webhook] no connected user for from=',
            msg.from,
            'phone_number_id=',
            change.value?.metadata?.phone_number_id
          );
          continue;
        }

        const from = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
        const n = await ingestWhatsAppWebhookMessage(userId, {
          id: msg.id,
          from,
          body: text,
          timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
        });
        if (n > 0) {
          try {
            const { notifyNewMessage } = await import('@/lib/push');
            await notifyNewMessage(userId, {
              platform: 'WhatsApp',
              from,
              preview: text,
              messageId: `whatsapp-${msg.id}`,
            });
          } catch (err) {
            console.warn('[whatsapp-webhook] push notify failed', err);
          }
        }
        ingested += n;
      }
    }
  }

  if (ingested === 0 && (body.entry?.length ?? 0) > 0) {
    // Status callbacks (delivered/read) have no messages[] — still 200 for Meta.
    console.info('[whatsapp-webhook] payload received, no new text messages ingested');
  }

  return NextResponse.json({ ok: true, ingested });
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
