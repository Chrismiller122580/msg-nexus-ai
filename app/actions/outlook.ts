'use server';

import { getDb, outlookConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { isMicrosoftConfigured } from '@/lib/microsoft';
import { syncOutlookForUser } from '@/lib/microsoft-sync';
import { revalidatePath } from 'next/cache';

export async function getOutlookStatus() {
  const user = await requireUser();
  const db = getDb();

  const [conn] = await db
    .select({
      email: outlookConnections.email,
      lastSyncedAt: outlookConnections.lastSyncedAt,
      connectedAt: outlookConnections.connectedAt,
    })
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, user.id))
    .limit(1);

  return {
    configured: isMicrosoftConfigured(),
    connected: Boolean(conn),
    email: conn?.email,
    lastSyncedAt: conn?.lastSyncedAt?.toISOString(),
    connectedAt: conn?.connectedAt?.toISOString(),
  };
}

export async function disconnectOutlookAction() {
  const user = await requireUser();
  const db = getDb();
  await db.delete(outlookConnections).where(eq(outlookConnections.userId, user.id));
  revalidatePath('/settings');
  return { success: true };
}

export async function syncOutlookAction(): Promise<{ success?: boolean; error?: string; imported?: number }> {
  try {
    const user = await requireUser();
    const result = await syncOutlookForUser(user.id);
    if (result.error) return { error: result.error };

    revalidatePath('/inbox');
    revalidatePath('/settings');
    return { success: true, imported: result.imported };
  } catch (err: unknown) {
    console.error('syncOutlookAction error:', err);
    return { error: err instanceof Error ? err.message : 'Outlook sync failed' };
  }
}