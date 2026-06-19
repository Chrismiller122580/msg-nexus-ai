'use server';

import { getDb, users, subscriptions, messages, connectedAccounts } from '@/db';
import { requireAdmin } from '@/lib/admin';
import { logAudit } from '@/lib/audit';
import { eq, desc, count, like, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function listAdminUsers(search?: string) {
  const admin = await requireAdmin();
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
  updates: { role?: 'user' | 'admin'; status?: 'active' | 'suspended'; name?: string }
) {
  const admin = await requireAdmin();
  if (userId === admin.id && updates.role === 'user') {
    return { error: 'Cannot demote yourself' };
  }
  if (userId === admin.id && updates.status === 'suspended') {
    return { error: 'Cannot suspend yourself' };
  }

  const db = getDb();
  await db.update(users).set(updates).where(eq(users.id, userId));

  const action = updates.status === 'suspended' ? 'user.suspend'
    : updates.status === 'active' ? 'user.activate'
    : updates.role === 'admin' ? 'user.promote_admin'
    : updates.role === 'user' ? 'user.demote_admin'
    : 'user.update';

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