'use server';

import { requireUser } from '@/lib/session';
import { getDb, telegramConnections, whatsappConnections, twilioConnections } from '@/db';
import { and, eq } from 'drizzle-orm';
import { sendSmsForUser } from '@/lib/sms-send';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendWhatsAppText, normalizeWhatsAppPhone } from '@/lib/whatsapp';
import { canSendPlatform } from '@/lib/outbound';
import { ingestMessages, ensureConnectedAccount } from '@/lib/connectors/ingest';
import { revalidatePath } from 'next/cache';
import type { PlatformId } from '@/lib/types';

export type ComposeInput = {
  platform: PlatformId;
  to: string;
  body: string;
  connectionId?: number;
};

export async function getComposeOptions() {
  const user = await requireUser();
  const db = getDb();

  const [sms, wa, tg] = await Promise.all([
    db.select().from(twilioConnections).where(eq(twilioConnections.userId, user.id)),
    db.select().from(whatsappConnections).where(eq(whatsappConnections.userId, user.id)),
    db
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.userId, user.id)),
  ]);

  let defaults: {
    defaultSendPlatform?: string | null;
    sendDefaults?: { sms?: number; whatsapp?: number; telegram?: number };
  } = {};
  try {
    const { getMyProfileAction } = await import('@/app/actions/profile');
    const profile = await getMyProfileAction();
    defaults = {
      defaultSendPlatform: profile.profile.defaultSendPlatform,
      sendDefaults: profile.profile.sendDefaults || {},
    };
  } catch {
    /* profile optional */
  }

  return {
    sms: sms.map((r: { id: number; phoneNumber: string }) => ({
      id: r.id,
      identifier: r.phoneNumber,
    })),
    whatsapp: wa.map((r: { id: number; phoneNumber: string }) => ({
      id: r.id,
      identifier: r.phoneNumber,
    })),
    telegram: tg
      .filter((r: { chatId: string | null }) => r.chatId)
      .map((r: { id: number; chatId: string | null; userName: string | null }) => ({
        id: r.id,
        identifier: r.userName || r.chatId || `tg-${r.id}`,
        chatId: r.chatId!,
      })),
    ...defaults,
  };
}

export async function sendMessageAction(
  input: ComposeInput
): Promise<{ success?: boolean; error?: string; messageId?: string }> {
  try {
    const user = await requireUser();
    const platform = input.platform;
    const body = input.body?.trim() || '';
    const to = input.to?.trim() || '';

    if (!canSendPlatform(platform)) {
      return { error: `${platform} does not support send yet from MsgNexus.` };
    }
    if (!body) return { error: 'Message cannot be empty.' };
    if (body.length > 4000) return { error: 'Message is too long (max 4000 characters).' };

    if (platform === 'sms') {
      if (!to) return { error: 'Enter a destination phone number.' };
      const result = await sendSmsForUser(user.id, to, body);
      if ('error' in result) return { error: result.error };
      revalidatePath('/inbox');
      revalidatePath('/dashboard');
      return { success: true, messageId: result.sid };
    }

    if (platform === 'whatsapp') {
      if (!to) return { error: 'Enter a WhatsApp destination number.' };
      const db = getDb();
      const conns = await db
        .select()
        .from(whatsappConnections)
        .where(eq(whatsappConnections.userId, user.id));
      if (conns.length === 0) return { error: 'Connect WhatsApp in Settings first.' };

      const result = await sendWhatsAppText(to, body);
      if (!result.ok) return { error: result.error };

      const toE164 = `+${normalizeWhatsAppPhone(to)}`;
      await ensureConnectedAccount(user.id, 'whatsapp', conns[0].phoneNumber, 'WhatsApp');
      await ingestMessages(
        user.id,
        [
          {
            externalId: result.messageId,
            platformId: 'whatsapp',
            from: 'You',
            body,
            timestamp: new Date().toISOString(),
          },
        ],
        `whatsapp-out-${conns[0].id}`
      );
      revalidatePath('/inbox');
      revalidatePath('/dashboard');
      return { success: true, messageId: result.messageId };
    }

    if (platform === 'telegram') {
      const db = getDb();
      let chatId = to;
      if (input.connectionId != null) {
        const [conn] = await db
          .select()
          .from(telegramConnections)
          .where(
            and(
              eq(telegramConnections.userId, user.id),
              eq(telegramConnections.id, input.connectionId)
            )
          )
          .limit(1);
        if (!conn?.chatId) return { error: 'Telegram chat not found.' };
        chatId = conn.chatId;
      }
      if (!chatId) return { error: 'Select a linked Telegram chat or enter chat id.' };

      const [owned] = await db
        .select()
        .from(telegramConnections)
        .where(
          and(eq(telegramConnections.userId, user.id), eq(telegramConnections.chatId, chatId))
        )
        .limit(1);
      if (!owned) return { error: 'That Telegram chat is not linked to your account.' };

      const result = await sendTelegramMessage(chatId, body);
      if (!result.ok) return { error: result.error };

      await ensureConnectedAccount(
        user.id,
        'telegram',
        owned.userName || chatId,
        'Telegram'
      );
      await ingestMessages(
        user.id,
        [
          {
            externalId: String(result.messageId),
            platformId: 'telegram',
            from: 'You',
            body,
            timestamp: new Date().toISOString(),
          },
        ],
        `telegram-out-${owned.id}`
      );
      revalidatePath('/inbox');
      revalidatePath('/dashboard');
      return { success: true, messageId: String(result.messageId) };
    }

    return { error: 'Unsupported platform.' };
  } catch (err: unknown) {
    console.error('sendMessageAction error:', err);
    return { error: err instanceof Error ? err.message : 'Send failed' };
  }
}
