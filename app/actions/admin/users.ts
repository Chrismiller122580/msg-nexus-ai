'use server';

import { getDb, users, subscriptions, messages, connectedAccounts } from '@/db';
import { requirePermission } from '@/lib/admin';
import type { Role } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { eq, desc, count, like, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function listAdminUsers(search?: string) {
  const admin = await requirePermission('users.read');
  const db = getDb();

  const rows = search
    ? await db
        .select()
        .from(users)
        .where(or(like(users.email, `%${search}%`), like(users.name, `%${search}%`)))
        .orderBy(desc(users.createdAt))
        .limit(100)
    : await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);

  const enriched = await Promise.all(
    rows.map(async (u: (typeof rows)[number]) => {
      const [msgCount] = await db.select({ count: count() }).from(messages).where(eq(messages.userId, u.id));
      const [connCount] = await db.select({ count: count() }).from(connectedAccounts).where(eq(connectedAccounts.userId, u.id));
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, u.id)).limit(1);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        messageCount: msgCount?.count ?? 0,
        connectionCount: connCount?.count ?? 0,
        plan: sub?.plan ?? 'free',
        subscriptionStatus: sub?.status ?? 'active',
      };
    })
  );

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'admin.list_users',
    resource: 'users',
    metadata: { search, count: enriched.length },
  });

  return enriched;
}

export async function updateUserAdminAction(
  userId: number,
  updates: { role?: Role; status?: 'active' | 'suspended'; name?: string }
) {
  const admin = await requirePermission('users.write');

  if (updates.role !== undefined) {
    await requirePermission('users.roles');
    if (userId === admin.id && updates.role !== 'admin') {
      return { error: 'Cannot change your own role' };
    }
  }

  if (userId === admin.id && updates.status === 'suspended') {
    return { error: 'Cannot suspend yourself' };
  }

  const db = getDb();
  await db.update(users).set(updates).where(eq(users.id, userId));

  let action = 'user.update';
  if (updates.status === 'suspended') action = 'user.suspend';
  else if (updates.status === 'active') action = 'user.activate';
  else if (updates.role === 'admin') action = 'user.promote_admin';
  else if (updates.role) action = 'user.role_change';

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action,
    resource: 'user',
    resourceId: String(userId),
    metadata: updates,
  });

  revalidatePath('/admin/users');
  return { success: true };
}