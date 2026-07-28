import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPulseAnalytics } from '../lib/pulse-analytics';
import type { Insight, Message } from '../lib/types';

function msg(partial: Partial<Message> & { id: string }): Message {
  return {
    platformId: 'email',
    timestamp: '2026-07-15T12:00:00.000Z',
    from: 'sender@example.com',
    body: 'hello',
    ...partial,
  };
}

function ins(partial: Partial<Insight> & { messageId: string }): Insight {
  return {
    category: 'other',
    confidence: 0.8,
    summary: 'test',
    entities: [],
    ...partial,
  };
}

describe('buildPulseAnalytics', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');

  it('computes monthly burn, annual run-rate, and total detected', () => {
    const messages = [
      msg({
        id: '1',
        body: 'Netflix subscription $15.49 monthly',
        timestamp: '2026-07-10T00:00:00.000Z',
      }),
      msg({
        id: '2',
        body: 'Netflix again $15.49 monthly',
        timestamp: '2026-07-12T00:00:00.000Z',
      }),
      msg({
        id: '3',
        body: 'Costco membership $60 for the year',
        timestamp: '2026-07-05T00:00:00.000Z',
      }),
      msg({
        id: '4',
        body: 'Amazon order $40.00',
        timestamp: '2026-07-18T00:00:00.000Z',
      }),
      msg({
        id: '5',
        body: 'Electric bill $100 due',
        timestamp: '2026-06-01T00:00:00.000Z',
      }),
    ];
    const insights: Record<string, Insight> = {
      '1': ins({
        messageId: '1',
        category: 'subscription',
        vendor: 'Netflix',
        amount: 15.49,
        currency: 'USD',
        isRecurring: true,
        summary: 'Netflix subscription monthly',
      }),
      '2': ins({
        messageId: '2',
        category: 'subscription',
        vendor: 'Netflix',
        amount: 15.49,
        currency: 'USD',
        isRecurring: true,
        summary: 'Netflix subscription monthly',
      }),
      '3': ins({
        messageId: '3',
        category: 'subscription',
        vendor: 'Costco',
        amount: 60,
        currency: 'USD',
        isRecurring: true,
        summary: 'Costco for the year',
      }),
      '4': ins({
        messageId: '4',
        category: 'shopping',
        vendor: 'Amazon',
        amount: 40,
        currency: 'USD',
        summary: 'Amazon purchase',
      }),
      '5': ins({
        messageId: '5',
        category: 'bill',
        vendor: 'Electric Co',
        amount: 100,
        currency: 'USD',
        summary: 'Electric bill',
      }),
    };

    const pulse = buildPulseAnalytics(messages, insights, now);

    // Netflix once + Costco 60/12 = 5 → 20.49
    assert.equal(pulse.activeSubCount, 2);
    assert.equal(pulse.monthlyRecurringLabel, '$20.49');
    assert.equal(pulse.annualRunRateLabel, '$245.88');

    // All charges: 15.49+15.49+60+40+100 = 230.98
    assert.equal(pulse.totalDetectedLabel, '$230.98');

    // This month (July): exclude June electric
    assert.equal(pulse.spentThisMonthLabel, '$130.98');

    assert.equal(pulse.billCount, 1);
    assert.equal(pulse.upcomingBillsLabel, '$100.00');
    assert.ok(pulse.shoppingSpendLabel.includes('40'));
    assert.ok(pulse.topVendors.length >= 2);
    assert.equal(pulse.largestSubscription?.vendor, 'Netflix');
  });

  it('keeps multi-currency totals separate', () => {
    const messages = [
      msg({ id: 'a', body: '€12.99 monthly' }),
      msg({ id: 'b', body: '$10 monthly' }),
    ];
    const insights: Record<string, Insight> = {
      a: ins({
        messageId: 'a',
        category: 'subscription',
        vendor: 'EU Stream',
        amount: 12.99,
        currency: 'EUR',
        isRecurring: true,
        summary: 'monthly',
      }),
      b: ins({
        messageId: 'b',
        category: 'subscription',
        vendor: 'US Stream',
        amount: 10,
        currency: 'USD',
        isRecurring: true,
        summary: 'monthly',
      }),
    };
    const pulse = buildPulseAnalytics(messages, insights, now);
    assert.ok(pulse.monthlyRecurringLabel.includes('$10.00'));
    assert.ok(pulse.monthlyRecurringLabel.includes('+'));
    assert.match(pulse.monthlyRecurringLabel, /12\.99|€/);
  });
});
