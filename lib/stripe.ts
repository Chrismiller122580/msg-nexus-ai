import crypto from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeKey(): string | null {
  return process.env.STRIPE_SECRET_KEY || null;
}

export function isStripeConfigured(): boolean {
  return Boolean(stripeKey() && process.env.STRIPE_PRICE_PRO);
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

async function stripeRequest<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = stripeKey();
  if (!key) throw new Error('Stripe is not configured');

  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Stripe request failed');
  }
  return data as T;
}

export async function createStripeCheckoutSession(params: {
  userId: number;
  email: string;
  plan: 'pro' | 'enterprise';
  customerId?: string | null;
}): Promise<{ url: string; sessionId: string }> {
  const priceId =
    params.plan === 'enterprise'
      ? process.env.STRIPE_PRICE_ENTERPRISE || process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_PRO;

  if (!priceId) throw new Error('Stripe price not configured');

  const base = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl()}/settings?billing=success`,
    cancel_url: `${appUrl()}/settings?billing=cancelled`,
    client_reference_id: String(params.userId),
    'metadata[userId]': String(params.userId),
    'metadata[plan]': params.plan,
  };

  const session = await stripeRequest<{ id: string; url: string }>(
    '/checkout/sessions',
    params.customerId
      ? { ...base, customer: params.customerId }
      : { ...base, customer_email: params.email }
  );

  return { url: session.url, sessionId: session.id };
}

export async function createStripePortalSession(customerId: string): Promise<string> {
  const session = await stripeRequest<{ url: string }>('/billing_portal/sessions', {
    customer: customerId,
    return_url: `${appUrl()}/settings`,
  });
  return session.url;
}

export function verifyStripeWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;

  const parts = Object.fromEntries(
    signature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );

  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;

  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export type StripeSubscriptionPayload = {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string } }> };
  metadata?: { userId?: string; plan?: string };
};

export function mapStripeStatus(status: string): 'active' | 'trialing' | 'cancelled' | 'past_due' {
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled' || status === 'incomplete_expired') return 'cancelled';
  return 'active';
}

export function planFromPriceId(priceId: string): 'pro' | 'enterprise' | 'free' {
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  return 'pro';
}