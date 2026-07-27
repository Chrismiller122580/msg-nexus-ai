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
    const msg = (id: string, from: string): Message => ({
      id,
      platformId: 'email',
      timestamp: '2026-07-01T00:00:00.000Z',
      from,
      body: 'subscription monthly',
    });
    const ins = (vendor: string, amount?: number): Insight => ({
      messageId: '',
      category: 'subscription',
      vendor,
      amount,
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
  });
});
