'use server';

import { getDb, subscriptions, users } from '@/db';
import { requireAdmin } from '@/lib/admin';
import { logAudit } from '@/lib/audit';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function listAdminSubscriptions() {
  await requireAdmin();
  const db = getDb();

  const rows = await db
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      plan: subscriptions.plan,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      createdAt: subscriptions.createdAt,
      email: users.email,
      name: users.name,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(100);

  return rows.map((r: (typeof rows)[number]) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    currentPeriodEnd: r.currentPeriodEnd?.toISOString(),
  }));
}

export async function updateSubscriptionAdminAction(
  userId: number,
  updates: { plan?: 'free' | 'pro' | 'enterprise'; status?: 'active' | 'trialing' | 'cancelled' | 'past_due'; cancelAtPeriodEnd?: boolean }
) {
  const admin = await requireAdmin();
  const db = getDb();

  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (!existing) {
    await db.insert(subscriptions).values({ userId, ...updates });
  } else {
    await db.update(subscriptions).set({ ...updates, updatedAt: new Date() }).where(eq(subscriptions.userId, userId));
  }

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: updates.status === 'cancelled' ? 'subscription.cancel' : 'subscription.update',
    resource: 'subscription',
    resourceId: String(userId),
    metadata: updates,
  });

  revalidatePath('/admin/subscriptions');
  revalidatePath('/admin/users');
  return { success: true as const };
}