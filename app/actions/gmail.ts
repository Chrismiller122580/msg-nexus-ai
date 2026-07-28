'use server';

import { getDb, gmailConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { and, eq } from 'drizzle-orm';
import { isGmailConfigured } from '@/lib/gmail';
import { syncGmailForUser } from '@/lib/gmail-sync';
import { revalidatePath } from 'next/cache';

export type ConnectionRow = {
  id: number;
  identifier: string;
  lastSyncedAt?: string;
  connectedAt?: string;
};

export async function getGmailStatus() {
  const user = await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      id: gmailConnections.id,
      email: gmailConnections.email,
      lastSyncedAt: gmailConnections.lastSyncedAt,
      connectedAt: gmailConnections.connectedAt,
    })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, user.id));

  const connections: ConnectionRow[] = rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    identifier: r.email,
    lastSyncedAt: r.lastSyncedAt?.toISOString(),
    connectedAt: r.connectedAt?.toISOString(),
  }));

  return {
    configured: isGmailConfigured(),
    connected: connections.length > 0,
    email: connections[0]?.identifier,
    identifier: connections[0]?.identifier,
    lastSyncedAt: connections[0]?.lastSyncedAt,
    connectedAt: connections[0]?.connectedAt,
    connections,
  };
}

/** Disconnect one Gmail account by id, or all if connectionId omitted. */
export async function disconnectGmailAction(connectionId?: number) {
  const user = await requireUser();
  const db = getDb();
  if (connectionId != null) {
    await db
      .delete(gmailConnections)
      .where(and(eq(gmailConnections.userId, user.id), eq(gmailConnections.id, connectionId)));
  } else {
    await db.delete(gmailConnections).where(eq(gmailConnections.userId, user.id));
  }
  revalidatePath('/settings');
  return { success: true };
}

export async function syncGmailAction(): Promise<{
  success?: boolean;
  error?: string;
  info?: string;
  imported?: number;
}> {
  try {
    const user = await requireUser();
    const result = await syncGmailForUser(user.id);
    if (result.error && (result.imported ?? 0) === 0) return { error: result.error };

    revalidatePath('/inbox');
    revalidatePath('/settings');
    return { success: true, imported: result.imported, info: result.info };
  } catch (err: unknown) {
    console.error('syncGmailAction error:', err);
    return { error: err instanceof Error ? err.message : 'Gmail sync failed' };
  }
}
