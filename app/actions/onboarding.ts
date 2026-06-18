'use server';

import { getDb, connectedAccounts, gmailConnections } from '@/db';
import { requireUser } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { PlatformId } from '@/lib/types';

export interface ConnectedAccountInput {
  platformId: PlatformId;
  identifier: string;
  label?: string;
}

export async function saveConnectedAccounts(accounts: ConnectedAccountInput[]) {
  const db = getDb();
  const user = await requireUser();

  const [gmail] = await db
    .select({ email: gmailConnections.email })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, user.id))
    .limit(1);

  await db.delete(connectedAccounts).where(eq(connectedAccounts.userId, user.id));

  const toSave = [...accounts];
  if (gmail?.email && !toSave.some((a) => a.platformId === 'email' && a.identifier === gmail.email)) {
    toSave.push({ platformId: 'email', identifier: gmail.email, label: 'Gmail' });
  }

  if (toSave.length > 0) {
    await db.insert(connectedAccounts).values(
      toSave.map((acc) => ({
        userId: user.id,
        platformId: acc.platformId,
        identifier: acc.identifier,
        label: acc.label || null,
      }))
    );
  }

  revalidatePath('/inbox');
  revalidatePath('/onboarding');

  return { success: true };
}

export async function getConnectedAccounts() {
  const db = getDb();
  const user = await requireUser();

  const rows = await db
    .select({
      id: connectedAccounts.id,
      platformId: connectedAccounts.platformId,
      identifier: connectedAccounts.identifier,
      label: connectedAccounts.label,
    })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, user.id));

  return rows.map((r: any) => ({
    id: r.id,
    platformId: r.platformId as PlatformId,
    identifier: r.identifier,
    label: r.label || undefined,
  }));
}