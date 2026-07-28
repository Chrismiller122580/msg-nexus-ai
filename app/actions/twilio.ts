'use server';

import { getDb, twilioConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { eq } from 'drizzle-orm';
import {
  getTwilioEnvPhoneNumber,
  isTwilioConfigured,
  isTwilioSendConfigured,
  normalizePhoneNumber,
  phonesMatch,
} from '@/lib/twilio';
import { sendSmsForUser } from '@/lib/sms-send';
import { syncTwilioForUser } from '@/lib/twilio-sync';
import { revalidatePath } from 'next/cache';

export async function getTwilioStatus() {
  const user = await requireUser();
  const db = getDb();
  const serverPhone = getTwilioEnvPhoneNumber();

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
    sendConfigured: isTwilioSendConfigured(),
    connected: Boolean(conn),
    phoneNumber: conn?.phoneNumber,
    identifier: conn?.phoneNumber,
    serverPhone: serverPhone ?? undefined,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
    connectedAt: conn?.connectedAt?.toISOString(),
  };
}

/**
 * Connect SMS. Prefer the server TWILIO_PHONE_NUMBER (the line that owns history).
 * Optional phoneNumber is accepted when it matches the server line, or when env is unset.
 */
export async function connectTwilioAction(
  phoneNumber?: string
): Promise<{ success?: boolean; error?: string; phoneNumber?: string }> {
  try {
    const user = await requireUser();
    if (!isTwilioConfigured()) {
      return { error: 'Twilio is not configured on the server.' };
    }

    const envLine = getTwilioEnvPhoneNumber();
    const entered = phoneNumber?.trim() ? normalizePhoneNumber(phoneNumber.trim()) : '';

    let line = envLine || entered;
    if (envLine && entered && !phonesMatch(envLine, entered)) {
      // Single-tenant: always bind to the server Twilio number for sync/webhooks
      line = envLine;
    }
    if (!line || line.replace(/\D/g, '').length < 10) {
      return {
        error:
          'Set TWILIO_PHONE_NUMBER on the server, or enter your Twilio number in E.164 (e.g. +15551234567).',
      };
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
        .set({ phoneNumber: line })
        .where(eq(twilioConnections.userId, user.id));
    } else {
      await db.insert(twilioConnections).values({
        userId: user.id,
        phoneNumber: line,
      });
    }

    revalidatePath('/settings');
    return { success: true, phoneNumber: line };
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

export async function syncTwilioAction(): Promise<{
  success?: boolean;
  error?: string;
  info?: string;
  imported?: number;
}> {
  try {
    const user = await requireUser();
    const result = await syncTwilioForUser(user.id);
    if (result.error) return { error: result.error };

    revalidatePath('/inbox');
    revalidatePath('/settings');
    return { success: true, imported: result.imported, info: result.info };
  } catch (err: unknown) {
    console.error('syncTwilioAction error:', err);
    return { error: err instanceof Error ? err.message : 'SMS sync failed' };
  }
}