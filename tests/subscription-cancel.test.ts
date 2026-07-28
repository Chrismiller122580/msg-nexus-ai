import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCancelGuide,
  buildSubscriptionCancelList,
} from '../lib/subscription-cancel';
import type { Insight, Message } from '../lib/types';

describe('getCancelGuide', () => {
  it('matches Netflix vendor', () => {
    const g = getCancelGuide('Netflix', 'Your Netflix subscription renews soon');
    assert.equal(g.key, 'netflix');
    assert.ok(g.cancelUrl?.includes('netflix'));
    assert.ok(g.steps.length >= 3);
  });

  it('matches Spotify from body only', () => {
    const g = getCancelGuide(undefined, 'Spotify Premium is $10.99 monthly');
    assert.equal(g.key, 'spotify');
  });

  it('returns generic guide for unknown vendors', () => {
    const g = getCancelGuide('WeirdSaaS Co', 'Thanks for subscribing');
    assert.equal(g.key, 'generic');
    assert.equal(g.displayName, 'WeirdSaaS Co');
    assert.ok(g.steps.length >= 4);
  });
});

describe('buildSubscriptionCancelList', () => {
  it('dedupes by vendor and prefers amount', () => {
    const msg = (id: string, from: string, body = 'subscription monthly'): Message => ({
      id,
      platformId: 'email',
      timestamp: '2026-07-01T00:00:00.000Z',
      from,
      body,
    });
    const ins = (vendor: string, amount?: number, currency = 'USD'): Insight => ({
      messageId: '',
      category: 'subscription',
      vendor,
      amount,
      currency,
      isRecurring: true,
      confidence: 0.8,
      summary: `${vendor} sub`,
      entities: [],
    });

    const list = buildSubscriptionCancelList([
      { message: msg('1', 'a@n.com'), insight: { ...ins('Netflix', 15.99), messageId: '1' } },
      { message: msg('2', 'b@n.com'), insight: { ...ins('Netflix', 15.99), messageId: '2' } },
      { message: msg('3', 's@s.com'), insight: { ...ins('Spotify', 10.99), messageId: '3' } },
    ]);

    assert.equal(list.length, 2);
    assert.ok(list.some((x) => x.vendor === 'Netflix'));
    assert.ok(list.some((x) => x.vendor === 'Spotify'));
    assert.equal(list[0].guide.key === 'netflix' || list[1].guide.key === 'netflix', true);
    const netflix = list.find((x) => x.vendor === 'Netflix')!;
    assert.equal(netflix.currency, 'USD');
    assert.equal(netflix.billingInterval, 'month');
    assert.equal(netflix.monthlyAmount, 15.99);
  });

  it('converts annual charges to monthlyAmount and keeps currency', () => {
    const list = buildSubscriptionCancelList([
      {
        message: {
          id: '1',
          platformId: 'email',
          timestamp: '2026-07-01T00:00:00.000Z',
          from: 'Costco',
          body: 'Gold Star membership renewal: $60.00 for the year.',
        },
        insight: {
          messageId: '1',
          category: 'subscription',
          vendor: 'Costco',
          amount: 60,
          currency: 'USD',
          isRecurring: true,
          confidence: 0.8,
          summary: 'Costco membership',
          entities: [],
        },
      },
      {
        message: {
          id: '2',
          platformId: 'email',
          timestamp: '2026-07-02T00:00:00.000Z',
          from: 'EU Co',
          body: 'Premium plan €120 yearly',
        },
        insight: {
          messageId: '2',
          category: 'subscription',
          vendor: 'EU Co',
          amount: 120,
          currency: 'EUR',
          isRecurring: true,
          confidence: 0.8,
          summary: 'EU Co subscription',
          entities: [],
        },
      },
    ]);

    const costco = list.find((x) => x.vendor === 'Costco')!;
    assert.equal(costco.billingInterval, 'year');
    assert.equal(costco.amount, 60);
    assert.equal(costco.monthlyAmount, 5);
    const eu = list.find((x) => x.vendor === 'EU Co')!;
    assert.equal(eu.currency, 'EUR');
    assert.equal(eu.monthlyAmount, 10);
  });
});
