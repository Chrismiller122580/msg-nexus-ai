'use server';

import { getDb, subscriptions } from '@/db';
import { requireUser } from '@/lib/session';
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  isStripeConfigured,
} from '@/lib/stripe';
import { eq } from 'drizzle-orm';

export async function getBillingStatus() {
  const user = await requireUser();
  const db = getDb();
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);

  return {
    configured: isStripeConfigured(),
    plan: sub?.plan ?? 'free',
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString(),
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    hasStripeCustomer: Boolean(sub?.stripeCustomerId),
  };
}

export async function startCheckoutAction(plan: 'pro' | 'enterprise'): Promise<{ url?: string; error?: string }> {
  if (!isStripeConfigured()) return { error: 'Billing is not configured' };

  const user = await requireUser();
  const db = getDb();
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);

  try {
    const session = await createStripeCheckoutSession({
      userId: user.id,
      email: user.email,
      plan,
      customerId: sub?.stripeCustomerId,
    });
    return { url: session.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Checkout failed' };
  }
}

export async function openBillingPortalAction(): Promise<{ url?: string; error?: string }> {
  if (!isStripeConfigured()) return { error: 'Billing is not configured' };

  const user = await requireUser();
  const db = getDb();
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1);

  if (!sub?.stripeCustomerId) return { error: 'No billing account found' };

  try {
    const url = await createStripePortalSession(sub.stripeCustomerId);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Portal failed' };
  }
}