'use server';

import { getDb, twilioConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { isTwilioConfigured, normalizePhoneNumber } from '@/lib/twilio';
import { sendSmsForUser } from '@/lib/sms-send';
import { syncTwilioForUser } from '@/lib/twilio-sync';
import { revalidatePath } from 'next/cache';

export async function getTwilioStatus() {
  const user = await requireUser();
  const db = getDb();

  const [conn] = await db
    .select({
      phoneNumber: twilioConnections.phoneNumber,
      lastSyncedAt: twilioConnections.lastSyncedAt,
      connectedAt: twilioConnections.connectedAt,
    })
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, user.id))
    .limit(1);

  return {
    configured: isTwilioConfigured(),
    connected: Boolean(conn),
    phoneNumber: conn?.phoneNumber,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
    connectedAt: conn?.connectedAt?.toISOString(),
  };
}

export async function connectTwilioAction(phoneNumber: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireUser();
    if (!isTwilioConfigured()) {
      return { error: 'Twilio is not configured on the server.' };
    }

    const normalized = normalizePhoneNumber(phoneNumber.trim());
    if (normalized.length < 11) {
      return { error: 'Please enter a valid phone number with country code.' };
    }

    const db = getDb();
    const existing = await db
      .select({ id: twilioConnections.id })
      .from(twilioConnections)
      .where(eq(twilioConnections.userId, user.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(twilioConnections)
        .set({ phoneNumber: normalized })
        .where(eq(twilioConnections.userId, user.id));
    } else {
      await db.insert(twilioConnections).values({
        userId: user.id,
        phoneNumber: normalized,
      });
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (err: unknown) {
    console.error('connectTwilioAction error:', err);
    return { error: err instanceof Error ? err.message : 'Failed to connect SMS' };
  }
}

export async function disconnectTwilioAction() {
  const user = await requireUser();
  const db = getDb();
  await db.delete(twilioConnections).where(eq(twilioConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function sendSmsAction(
  to: string,
  message: string
): Promise<{ success?: boolean; error?: string; sid?: string }> {
  try {
    const user = await requireUser();
    const result = await sendSmsForUser(user.id, to, message);
    if ('error' in result) return { error: result.error };
    revalidatePath('/inbox');
    return { success: true, sid: result.sid };
  } catch (err: unknown) {
    console.error('sendSmsAction error:', err);
    return { error: err instanceof Error ? err.message : 'Failed to send SMS' };
  }
}

export async function syncTwilioAction(): Promise<{ success?: boolean; error?: string; imported?: number }> {
  try {
    const user = await requireUser();
    const result = await syncTwilioForUser(user.id);
    if (result.error) return { error: result.error };

    revalidatePath('/inbox');
    revalidatePath('/settings');
    return { success: true, imported: result.imported };
  } catch (err: unknown) {
    console.error('syncTwilioAction error:', err);
    return { error: err instanceof Error ? err.message : 'SMS sync failed' };
  }
}