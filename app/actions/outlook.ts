'use server';

import { getDb, outlookConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { and, eq } from 'drizzle-orm';
import { isMicrosoftConfigured } from '@/lib/microsoft';
import { syncOutlookForUser } from '@/lib/microsoft-sync';
import { revalidatePath } from 'next/cache';
import type { ConnectionRow } from '@/app/actions/gmail';

export async function getOutlookStatus() {
  const user = await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      id: outlookConnections.id,
      email: outlookConnections.email,
      lastSyncedAt: outlookConnections.lastSyncedAt,
      connectedAt: outlookConnections.connectedAt,
    })
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, user.id));

  const connections: ConnectionRow[] = rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    identifier: r.email,
    lastSyncedAt: r.lastSyncedAt?.toISOString(),
    connectedAt: r.connectedAt?.toISOString(),
  }));

  return {
    configured: isMicrosoftConfigured(),
    connected: connections.length > 0,
    email: connections[0]?.identifier,
    identifier: connections[0]?.identifier,
    lastSyncedAt: connections[0]?.lastSyncedAt,
    connectedAt: connections[0]?.connectedAt,
    connections,
  };
}

export async function disconnectOutlookAction(connectionId?: number) {
  const user = await requireUser();
  const db = getDb();
  if (connectionId != null) {
    await db
      .delete(outlookConnections)
      .where(and(eq(outlookConnections.userId, user.id), eq(outlookConnections.id, connectionId)));
  } else {
    await db.delete(outlookConnections).where(eq(outlookConnections.userId, user.id));
  }
  revalidatePath('/settings');
  return { success: true };
}

export async function syncOutlookAction(): Promise<{
  success?: boolean;
  error?: string;
  info?: string;
  imported?: number;
}> {
  try {
    const user = await requireUser();
    const result = await syncOutlookForUser(user.id);
    if (result.error && (result.imported ?? 0) === 0) return { error: result.error };

    revalidatePath('/inbox');
    revalidatePath('/settings');
    return { success: true, imported: result.imported, info: result.info };
  } catch (err: unknown) {
    console.error('syncOutlookAction error:', err);
    return { error: err instanceof Error ? err.message : 'Outlook sync failed' };
  }
}
