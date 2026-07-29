'use server';

import { requireUser } from '@/lib/session';
import { getDb, pushSubscriptions } from '@/db';
import { and, eq } from 'drizzle-orm';
import { getVapidPublicKey, isWebPushConfigured, notifyUser } from '@/lib/push';
import { revalidatePath } from 'next/cache';

export async function getPushStatus() {
  const user = await requireUser();
  const configured = isWebPushConfigured();
  const publicKey = getVapidPublicKey();
  const db = getDb();
  const rows = await db
    .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));

  return {
    configured,
    publicKey,
    subscribed: rows.length > 0,
    deviceCount: rows.length,
  };
}

export async function subscribePushAction(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireUser();
    if (!isWebPushConfigured()) {
      return { error: 'Push is not configured on the server (VAPID keys missing).' };
    }
    if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
      return { error: 'Invalid push subscription.' };
    }

    const db = getDb();
    const existing = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: user.id,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent || null,
          lastUsedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing[0].id));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent || null,
      });
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (err: unknown) {
    console.error('subscribePushAction', err);
    return { error: err instanceof Error ? err.message : 'Failed to save subscription' };
  }
}

export async function unsubscribePushAction(
  endpoint?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const db = getDb();
    if (endpoint) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint))
        );
    } else {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    }
    revalidatePath('/settings');
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to unsubscribe' };
  }
}

export async function sendTestPushAction(): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const r = await notifyUser(user.id, {
      title: 'MsgNexus test',
      body: 'Push notifications are working.',
      url: '/dashboard',
      tag: 'test',
    });
    if (r.sent === 0) {
      return { error: 'No devices subscribed, or push is not configured.' };
    }
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Test push failed' };
  }
}
