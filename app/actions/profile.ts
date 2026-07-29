'use server';

import {
  getDb,
  users,
  userProfiles,
  messages,
  insights,
  connectedAccounts,
  gmailConnections,
  outlookConnections,
  twilioConnections,
  slackConnections,
  discordConnections,
  telegramConnections,
  whatsappConnections,
  xConnections,
  pushSubscriptions,
  smsMessages,
  magicLinks,
} from '@/db';
import { requireUser, clearSession } from '@/lib/session';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  type ProfileSocials,
  type SendDefaults,
  type ProfileRecord,
  normalizeHandle,
  suggestHandleFromEmail,
  validateHandle,
  toPublicCard,
  publicCardUrl,
} from '@/lib/profile';

function mapRow(row: typeof userProfiles.$inferSelect): ProfileRecord {
  return {
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    location: row.location,
    websiteUrl: row.websiteUrl,
    publicEmail: row.publicEmail,
    publicPhone: row.publicPhone,
    socials: (row.socials as ProfileSocials) || {},
    theme: row.theme,
    accentColor: row.accentColor,
    isPublic: row.isPublic,
    showEmail: row.showEmail,
    showPhone: row.showPhone,
    showConnections: row.showConnections,
    allowContactForm: row.allowContactForm,
    defaultSendPlatform: row.defaultSendPlatform,
    sendDefaults: (row.sendDefaults as SendDefaults) || {},
  };
}

async function ensureProfile(userId: number, email: string, name?: string | null) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  if (existing) return mapRow(existing);

  let handle = suggestHandleFromEmail(email);
  // ensure unique
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? handle : `${handle.slice(0, 28)}-${i + 1}`;
    const [taken] = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.handle, candidate))
      .limit(1);
    if (!taken) {
      handle = candidate;
      break;
    }
  }

  await db.insert(userProfiles).values({
    userId,
    handle,
    displayName: name || email.split('@')[0] || handle,
    publicEmail: email,
    socials: {},
    sendDefaults: {},
  });

  const [created] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return mapRow(created!);
}

export async function getMyProfileAction() {
  const user = await requireUser();
  const profile = await ensureProfile(user.id, user.email, user.name);
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.msgnexus.ai';

  // available public channel labels
  const db = getDb();
  const channels: string[] = [];
  const [sms] = await db
    .select({ id: twilioConnections.id })
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, user.id))
    .limit(1);
  const [wa] = await db
    .select({ id: whatsappConnections.id })
    .from(whatsappConnections)
    .where(eq(whatsappConnections.userId, user.id))
    .limit(1);
  const [tg] = await db
    .select({ id: telegramConnections.id })
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, user.id))
    .limit(1);
  if (sms) channels.push('SMS');
  if (wa) channels.push('WhatsApp');
  if (tg) channels.push('Telegram');

  return {
    profile,
    email: user.email,
    publicUrl: publicCardUrl(profile.handle, origin),
    availableChannels: channels,
  };
}

export async function checkHandleAvailableAction(handle: string) {
  const user = await requireUser();
  const v = validateHandle(handle);
  if (!v.ok) return v;
  const db = getDb();
  const [taken] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(and(eq(userProfiles.handle, v.handle), ne(userProfiles.userId, user.id)))
    .limit(1);
  if (taken) return { ok: false as const, error: 'That handle is already taken.' };
  return { ok: true as const, handle: v.handle };
}

export type ProfileUpdateInput = {
  handle?: string;
  displayName?: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  socials?: ProfileSocials;
  theme?: string;
  accentColor?: string | null;
  isPublic?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  showConnections?: boolean;
  allowContactForm?: boolean;
  defaultSendPlatform?: string | null;
  sendDefaults?: SendDefaults;
};

export async function upsertMyProfileAction(input: ProfileUpdateInput) {
  try {
    const user = await requireUser();
    await ensureProfile(user.id, user.email, user.name);
    const db = getDb();

    const updates: Record<string, unknown> = { updatedAt: new Date(), cardUpdatedAt: new Date() };

    if (input.handle != null) {
      const check = await checkHandleAvailableAction(input.handle);
      if (!check.ok) return { error: check.error };
      updates.handle = check.handle;
    }
    if (input.displayName !== undefined) updates.displayName = input.displayName?.trim() || null;
    if (input.headline !== undefined) updates.headline = input.headline?.trim() || null;
    if (input.bio !== undefined) updates.bio = input.bio?.trim() || null;
    if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl?.trim() || null;
    if (input.location !== undefined) updates.location = input.location?.trim() || null;
    if (input.websiteUrl !== undefined) updates.websiteUrl = input.websiteUrl?.trim() || null;
    if (input.publicEmail !== undefined) updates.publicEmail = input.publicEmail?.trim() || null;
    if (input.publicPhone !== undefined) updates.publicPhone = input.publicPhone?.trim() || null;
    if (input.socials !== undefined) updates.socials = input.socials;
    if (input.theme !== undefined) updates.theme = input.theme;
    if (input.accentColor !== undefined) updates.accentColor = input.accentColor;
    if (input.isPublic !== undefined) updates.isPublic = input.isPublic;
    if (input.showEmail !== undefined) updates.showEmail = input.showEmail;
    if (input.showPhone !== undefined) updates.showPhone = input.showPhone;
    if (input.showConnections !== undefined) updates.showConnections = input.showConnections;
    if (input.allowContactForm !== undefined) updates.allowContactForm = input.allowContactForm;
    if (input.defaultSendPlatform !== undefined) {
      updates.defaultSendPlatform = input.defaultSendPlatform;
    }
    if (input.sendDefaults !== undefined) updates.sendDefaults = input.sendDefaults;

    // also sync users.name for greeting
    if (input.displayName !== undefined) {
      await db
        .update(users)
        .set({ name: input.displayName?.trim() || null })
        .where(eq(users.id, user.id));
    }

    await db.update(userProfiles).set(updates).where(eq(userProfiles.userId, user.id));

    revalidatePath('/profile');
    revalidatePath('/dashboard');
    revalidatePath('/compose');
    if (updates.handle) revalidatePath(`/u/${updates.handle}`);

    return { success: true };
  } catch (err: unknown) {
    console.error('upsertMyProfileAction', err);
    return { error: err instanceof Error ? err.message : 'Failed to save profile' };
  }
}

export async function getPublicProfileByHandleAction(handle: string) {
  const h = normalizeHandle(handle);
  if (!h) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.handle, h))
    .limit(1);
  if (!row || !row.isPublic) return null;

  const profile = mapRow(row);
  const channels: string[] = [];
  const uid = row.userId;
  const [sms] = await db
    .select({ id: twilioConnections.id })
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, uid))
    .limit(1);
  const [wa] = await db
    .select({ id: whatsappConnections.id })
    .from(whatsappConnections)
    .where(eq(whatsappConnections.userId, uid))
    .limit(1);
  const [tg] = await db
    .select({ id: telegramConnections.id })
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, uid))
    .limit(1);
  if (sms) channels.push('SMS');
  if (wa) channels.push('WhatsApp');
  if (tg) channels.push('Telegram');

  return toPublicCard(profile, channels);
}

export async function disconnectAllConnectionsAction() {
  try {
    const user = await requireUser();
    const db = getDb();
    const uid = user.id;
    await Promise.all([
      db.delete(gmailConnections).where(eq(gmailConnections.userId, uid)),
      db.delete(outlookConnections).where(eq(outlookConnections.userId, uid)),
      db.delete(twilioConnections).where(eq(twilioConnections.userId, uid)),
      db.delete(slackConnections).where(eq(slackConnections.userId, uid)),
      db.delete(discordConnections).where(eq(discordConnections.userId, uid)),
      db.delete(telegramConnections).where(eq(telegramConnections.userId, uid)),
      db.delete(whatsappConnections).where(eq(whatsappConnections.userId, uid)),
      db.delete(xConnections).where(eq(xConnections.userId, uid)),
      db.delete(connectedAccounts).where(eq(connectedAccounts.userId, uid)),
    ]);
    revalidatePath('/settings');
    revalidatePath('/profile');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to disconnect' };
  }
}

export async function deleteAllMessagesAction() {
  try {
    const user = await requireUser();
    const db = getDb();
    const uid = user.id;
    const msgRows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.userId, uid));
    const ids = msgRows.map((m: { id: string }) => m.id);
    if (ids.length > 0) {
      await db.delete(insights).where(inArray(insights.messageId, ids));
    }
    await db.delete(messages).where(eq(messages.userId, uid));
    await db.delete(smsMessages).where(eq(smsMessages.userId, uid));
    revalidatePath('/inbox');
    revalidatePath('/dashboard');
    revalidatePath('/profile');
    return { success: true, deleted: ids.length };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to delete messages' };
  }
}

export async function deleteAccountAction(confirm: string) {
  try {
    const user = await requireUser();
    const profile = await ensureProfile(user.id, user.email, user.name);
    const ok =
      confirm.trim().toLowerCase() === user.email.toLowerCase() ||
      confirm.trim().toLowerCase() === profile.handle.toLowerCase() ||
      confirm.trim().toLowerCase() === 'delete';
    if (!ok) {
      return { error: 'Type your email, handle, or DELETE to confirm.' };
    }

    const db = getDb();
    const uid = user.id;

    // delete children that may not cascade from users in all cases
    await deleteAllMessagesAction();
    await disconnectAllConnectionsAction();
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, uid));
    await db.delete(userProfiles).where(eq(userProfiles.userId, uid));
    await db.delete(magicLinks).where(eq(magicLinks.email, user.email));
    await db.delete(users).where(eq(users.id, uid));
    await clearSession();

    return { success: true };
  } catch (err: unknown) {
    console.error('deleteAccountAction', err);
    return { error: err instanceof Error ? err.message : 'Failed to delete account' };
  }
}
