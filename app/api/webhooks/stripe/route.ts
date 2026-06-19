import { NextResponse } from 'next/server';
import { getDb, subscriptions } from '@/db';
import {
  verifyStripeWebhookSignature,
  mapStripeStatus,
  planFromPriceId,
  type StripeSubscriptionPayload,
} from '@/lib/stripe';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  if (!verifyStripeWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
  const db = getDb();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      client_reference_id?: string;
      customer?: string;
      subscription?: string;
      metadata?: { userId?: string; plan?: string };
    };

    const userId = parseInt(session.metadata?.userId || session.client_reference_id || '', 10);
    if (!isNaN(userId) && session.customer) {
      const plan = (session.metadata?.plan as 'pro' | 'enterprise') || 'pro';
      const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

      if (existing) {
        await db.update(subscriptions).set({
          plan,
          status: 'active',
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
          updatedAt: new Date(),
        }).where(eq(subscriptions.userId, userId));
      } else {
        await db.insert(subscriptions).values({
          userId,
          plan,
          status: 'active',
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
        });
      }

      await dispatchWebhookEvent('subscription.updated', { userId, plan, status: 'active', source: 'stripe' });
    }
  }

  if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const sub = event.data.object as StripeSubscriptionPayload;
    const userId = parseInt(sub.metadata?.userId || '', 10);
    const priceId = sub.items?.data?.[0]?.price?.id;
    const plan = sub.metadata?.plan as 'pro' | 'enterprise' | undefined || (priceId ? planFromPriceId(priceId) : 'pro');
    const status = event.type === 'customer.subscription.deleted' ? 'cancelled' : mapStripeStatus(sub.status);

    if (!isNaN(userId)) {
      await db.update(subscriptions).set({
        plan: status === 'cancelled' ? 'free' : plan,
        status,
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId || null,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      }).where(eq(subscriptions.userId, userId));

      await dispatchWebhookEvent('subscription.updated', { userId, plan, status, source: 'stripe' });
    } else if (sub.customer) {
      await db.update(subscriptions).set({
        plan: status === 'cancelled' ? 'free' : plan,
        status,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId || null,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeCustomerId, String(sub.customer)));
    }
  }

  return NextResponse.json({ received: true });
}