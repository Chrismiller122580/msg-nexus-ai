import crypto from 'crypto';
import { getDb, webhooks, webhookDeliveries } from '@/db';
import { eq, and } from 'drizzle-orm';
import type { WebhookEvent } from '@/lib/webhook-events';

export type { WebhookEvent } from '@/lib/webhook-events';
export { WEBHOOK_EVENTS } from '@/lib/webhook-events';

function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export async function dispatchWebhookEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>
) {
  const db = getDb();
  const hooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.enabled, true)));

  const matching = hooks.filter((h: (typeof hooks)[number]) => {
    const events = Array.isArray(h.events) ? h.events : [];
    return events.includes(event) || events.includes('*');
  });

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

  await Promise.all(
    matching.map(async (hook: (typeof matching)[number]) => {
      const signature = signPayload(hook.secret, body);
      let status = 'failed';
      let responseCode: number | null = null;
      let responseBody: string | null = null;

      try {
        const res = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MsgNexus-Event': event,
            'X-MsgNexus-Signature': signature,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });
        responseCode = res.status;
        responseBody = (await res.text()).slice(0, 500);
        status = res.ok ? 'success' : 'failed';
      } catch (err) {
        responseBody = err instanceof Error ? err.message : 'Request failed';
      }

      await db.insert(webhookDeliveries).values({
        webhookId: hook.id,
        event,
        payload: JSON.parse(body),
        status,
        responseCode,
        responseBody,
      });

      await db.update(webhooks).set({ lastTriggeredAt: new Date() }).where(eq(webhooks.id, hook.id));
    })
  );
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('base64url');
}