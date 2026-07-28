'use server';

import { getDb, twilioConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { and, eq } from 'drizzle-orm';
import {
  getTwilioEnvPhoneNumber,
  isTwilioConfigured,
  isTwilioSendConfigured,
  normalizePhoneNumber,
} from '@/lib/twilio';
import { sendSmsForUser } from '@/lib/sms-send';
import { syncTwilioForUser } from '@/lib/twilio-sync';
import { revalidatePath } from 'next/cache';
import type { ConnectionRow } from '@/app/actions/gmail';

export async function getTwilioStatus() {
  const user = await requireUser();
  const db = getDb();
  const serverPhone = getTwilioEnvPhoneNumber();

  const rows = await db
    .select({
      id: twilioConnections.id,
      phoneNumber: twilioConnections.phoneNumber,
      lastSyncedAt: twilioConnections.lastSyncedAt,
      connectedAt: twilioConnections.connectedAt,
    })
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, user.id));

  const connections: ConnectionRow[] = rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    identifier: r.phoneNumber,
    lastSyncedAt: r.lastSyncedAt?.toISOString(),
    connectedAt: r.connectedAt?.toISOString(),
  }));

  return {
    configured: isTwilioConfigured(),
    sendConfigured: isTwilioSendConfigured(),
    connected: connections.length > 0,
    phoneNumber: connections[0]?.identifier,
    identifier: connections[0]?.identifier,
    serverPhone: serverPhone ?? undefined,
    lastSyncedAt: connections[0]?.lastSyncedAt,
    connectedAt: connections[0]?.connectedAt,
    connections,
  };
}

/**
 * Connect an SMS line. Accepts any E.164 number; prefers TWILIO_PHONE_NUMBER when empty.
 * Multiple numbers per user are allowed (unique per user + phone).
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
    const line = entered || envLine;

    if (!line || line.replace(/\D/g, '').length < 10) {
      return {
        error:
          'Enter a phone number in E.164 (e.g. +15551234567), or set TWILIO_PHONE_NUMBER on the server.',
      };
    }

    const db = getDb();
    const existing = await db
      .select({ id: twilioConnections.id })
      .from(twilioConnections)
      .where(and(eq(twilioConnections.userId, user.id), eq(twilioConnections.phoneNumber, line)))
      .limit(1);

    if (existing.length === 0) {
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

export async function disconnectTwilioAction(connectionId?: number) {
  const user = await requireUser();
  const db = getDb();
  if (connectionId != null) {
    await db
      .delete(twilioConnections)
      .where(and(eq(twilioConnections.userId, user.id), eq(twilioConnections.id, connectionId)));
  } else {
    await db.delete(twilioConnections).where(eq(twilioConnections.userId, user.id));
  }
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
