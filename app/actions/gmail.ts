'use server';

import { getDb, gmailConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { isGmailConfigured } from '@/lib/gmail';
import { syncGmailForUser } from '@/lib/gmail-sync';
import { revalidatePath } from 'next/cache';

export async function getGmailStatus() {
  const user = await requireUser();
  const db = getDb();

  const [conn] = await db
    .select({
      email: gmailConnections.email,
      lastSyncedAt: gmailConnections.lastSyncedAt,
      connectedAt: gmailConnections.connectedAt,
    })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, user.id))
    .limit(1);

  return {
    configured: isGmailConfigured(),
    connected: Boolean(conn),
    email: conn?.email,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
    connectedAt: conn?.connectedAt?.toISOString(),
  };
}

export async function disconnectGmailAction() {
  const user = await requireUser();
  const db = getDb();
  await db.delete(gmailConnections).where(eq(gmailConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function syncGmailAction(): Promise<{ success?: boolean; error?: string; imported?: number }> {
  try {
    const user = await requireUser();
    const result = await syncGmailForUser(user.id);
    if (result.error) return { error: result.error };

    revalidatePath('/inbox');
    revalidatePath('/settings');
    return { success: true, imported: result.imported };
  } catch (err: unknown) {
    console.error('syncGmailAction error:', err);
    return { error: err instanceof Error ? err.message : 'Gmail sync failed' };
  }
}
