import webpush from 'web-push';
import { getDb, pushSubscriptions } from '@/db';
import { eq } from 'drizzle-orm';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:onboarding@msgnexus.ai';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function notifyUser(
  userId: number,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!isWebPushConfigured() || !configureWebPush()) {
    return { sent: 0, failed: 0 };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag || 'msgnexus',
  });

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
        { TTL: 60 * 60 }
      );
      sent++;
      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscriptions.id, row.id));
    } catch (err: unknown) {
      failed++;
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
      } else {
        console.warn('[push] send failed', status, err);
      }
    }
  }

  return { sent, failed };
}

export async function notifyNewMessage(
  userId: number,
  opts: { platform: string; from: string; preview: string; messageId?: string }
) {
  const preview = opts.preview.slice(0, 120);
  return notifyUser(userId, {
    title: `New ${opts.platform}`,
    body: `${opts.from}: ${preview}`,
    url: opts.messageId ? `/inbox?messageId=${encodeURIComponent(opts.messageId)}` : '/inbox',
    tag: opts.messageId ? `msg-${opts.messageId}` : `plat-${opts.platform}`,
  });
}
