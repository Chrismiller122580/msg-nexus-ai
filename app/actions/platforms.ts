'use server';

import { getDb, slackConnections, discordConnections, telegramConnections, whatsappConnections, xConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { isSlackConfigured } from '@/lib/slack';
import { syncSlackForUser } from '@/lib/slack-sync';
import { isDiscordConfigured } from '@/lib/discord';
import { syncDiscordForUser } from '@/lib/discord-sync';
import { isTelegramConfigured, createTelegramLinkCode } from '@/lib/telegram';
import { syncTelegramForUser } from '@/lib/telegram-sync';
import { isWhatsAppConfigured, normalizeWhatsAppPhone } from '@/lib/whatsapp';
import { syncWhatsAppForUser } from '@/lib/whatsapp-sync';
import { isXConfigured } from '@/lib/x-api';
import { syncXForUser } from '@/lib/x-sync';

type PlatformStatus = {
  configured: boolean;
  connected: boolean;
  identifier?: string;
  linkCode?: string;
  lastSyncedAt?: string;
};

async function getSlackStatusForUser(userId: number): Promise<PlatformStatus> {
  const db = getDb();
  const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
  return {
    configured: isSlackConfigured(),
    connected: Boolean(conn),
    identifier: conn?.userName,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
  };
}

async function getDiscordStatusForUser(userId: number): Promise<PlatformStatus> {
  const db = getDb();
  const [conn] = await db.select().from(discordConnections).where(eq(discordConnections.userId, userId)).limit(1);
  return {
    configured: isDiscordConfigured(),
    connected: Boolean(conn),
    identifier: conn?.userName,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
  };
}

async function getTelegramStatusForUser(userId: number): Promise<PlatformStatus> {
  const db = getDb();
  const [conn] = await db.select().from(telegramConnections).where(eq(telegramConnections.userId, userId)).limit(1);
  return {
    configured: isTelegramConfigured(),
    connected: Boolean(conn?.chatId),
    identifier: conn?.userName,
    linkCode: conn?.linkCode || undefined,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
  };
}

async function getWhatsAppStatusForUser(userId: number): Promise<PlatformStatus> {
  const db = getDb();
  const [conn] = await db.select().from(whatsappConnections).where(eq(whatsappConnections.userId, userId)).limit(1);
  return {
    configured: isWhatsAppConfigured(),
    connected: Boolean(conn),
    identifier: conn?.phoneNumber,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
  };
}

async function getXStatusForUser(userId: number): Promise<PlatformStatus> {
  const db = getDb();
  const [conn] = await db.select().from(xConnections).where(eq(xConnections.userId, userId)).limit(1);
  return {
    configured: isXConfigured(),
    connected: Boolean(conn),
    identifier: conn?.userName,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
  };
}

export async function getAllPlatformStatuses() {
  const user = await requireUser();
  const [slack, discord, telegram, whatsapp, x] = await Promise.all([
    getSlackStatusForUser(user.id),
    getDiscordStatusForUser(user.id),
    getTelegramStatusForUser(user.id),
    getWhatsAppStatusForUser(user.id),
    getXStatusForUser(user.id),
  ]);
  return { slack, discord, telegram, whatsapp, x };
}

export async function disconnectSlackAction() {
  const user = await requireUser();
  await getDb().delete(slackConnections).where(eq(slackConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function disconnectDiscordAction() {
  const user = await requireUser();
  await getDb().delete(discordConnections).where(eq(discordConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function disconnectTelegramAction() {
  const user = await requireUser();
  await getDb().delete(telegramConnections).where(eq(telegramConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function disconnectWhatsAppAction() {
  const user = await requireUser();
  await getDb().delete(whatsappConnections).where(eq(whatsappConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function disconnectXAction() {
  const user = await requireUser();
  await getDb().delete(xConnections).where(eq(xConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function syncSlackAction() {
  const user = await requireUser();
  const result = await syncSlackForUser(user.id);
  if (result.error) return { error: result.error };
  revalidatePath('/inbox');
  revalidatePath('/settings');
  return { success: true, imported: result.imported };
}

export async function syncDiscordAction() {
  const user = await requireUser();
  const result = await syncDiscordForUser(user.id);
  if (result.error) return { error: result.error };
  revalidatePath('/inbox');
  revalidatePath('/settings');
  return { success: true, imported: result.imported };
}

export async function syncTelegramAction() {
  const user = await requireUser();
  const result = await syncTelegramForUser(user.id);
  if (result.error) return { error: result.error };
  revalidatePath('/inbox');
  revalidatePath('/settings');
  return { success: true, imported: result.imported };
}

export async function syncWhatsAppAction() {
  const user = await requireUser();
  const result = await syncWhatsAppForUser(user.id);
  if (result.error) return { error: result.error };
  revalidatePath('/inbox');
  revalidatePath('/settings');
  return { success: true, imported: result.imported };
}

export async function syncXAction() {
  const user = await requireUser();
  const result = await syncXForUser(user.id);
  if (result.error) return { error: result.error };
  revalidatePath('/inbox');
  revalidatePath('/settings');
  return { success: true, imported: result.imported };
}

export async function startTelegramLinkAction(): Promise<{ success?: boolean; error?: string; linkCode?: string; botUsername?: string }> {
  try {
    const user = await requireUser();
    if (!isTelegramConfigured()) return { error: 'Telegram bot is not configured on the server.' };
    const linkCode = await createTelegramLinkCode(user.id);
    revalidatePath('/settings');
    return {
      success: true,
      linkCode,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'your_bot',
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to start Telegram link' };
  }
}

export async function connectWhatsAppAction(phoneNumber: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireUser();
    if (!isWhatsAppConfigured()) return { error: 'WhatsApp Business API is not configured.' };
    const normalized = normalizeWhatsAppPhone(phoneNumber.trim());
    if (normalized.length < 10) return { error: 'Enter a valid WhatsApp phone number.' };

    const db = getDb();
    const phone = `+${normalized}`;
    const existing = await db.select().from(whatsappConnections).where(eq(whatsappConnections.userId, user.id)).limit(1);

    if (existing.length > 0) {
      await db.update(whatsappConnections).set({ phoneNumber: phone }).where(eq(whatsappConnections.userId, user.id));
    } else {
      await db.insert(whatsappConnections).values({ userId: user.id, phoneNumber: phone });
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to connect WhatsApp' };
  }
}