import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectBillingInterval,
  extractAmountAndCurrency,
  formatCurrency,
  formatMoneyTotals,
  normalizeCurrencyCode,
  toMonthlyAmount,
} from '../lib/money';
import { parseMessage } from '../lib/ai-parser';

describe('normalizeCurrencyCode', () => {
  it('maps symbols and codes', () => {
    assert.equal(normalizeCurrencyCode('$'), 'USD');
    assert.equal(normalizeCurrencyCode('€'), 'EUR');
    assert.equal(normalizeCurrencyCode('£'), 'GBP');
    assert.equal(normalizeCurrencyCode('cad'), 'CAD');
    assert.equal(normalizeCurrencyCode('US$'), 'USD');
  });

  it('falls back safely for junk', () => {
    assert.equal(normalizeCurrencyCode('US$'), 'USD');
    assert.equal(normalizeCurrencyCode('$$$'), 'USD');
    assert.equal(normalizeCurrencyCode(null), 'USD');
  });
});

describe('formatCurrency', () => {
  it('formats USD and EUR', () => {
    assert.equal(formatCurrency(15.49, 'USD'), '$15.49');
    assert.match(formatCurrency(12.99, 'EUR'), /12\.99/);
  });

  it('does not throw on invalid currency codes', () => {
    assert.ok(formatCurrency(10, 'US$').length > 0);
    assert.ok(formatCurrency(10, 'not-a-code').length > 0);
  });
});

describe('extractAmountAndCurrency', () => {
  it('detects euro and pound symbols', () => {
    assert.deepEqual(extractAmountAndCurrency('Charge of €12.99 monthly'), {
      amount: 12.99,
      currency: 'EUR',
    });
    assert.deepEqual(extractAmountAndCurrency('Billed £9.99/month'), {
      amount: 9.99,
      currency: 'GBP',
    });
  });

  it('detects CAD prefix', () => {
    const r = extractAmountAndCurrency('CAD $14.99 subscription');
    assert.equal(r.amount, 14.99);
    assert.equal(r.currency, 'CAD');
  });
});

describe('billing interval', () => {
  it('detects year vs month', () => {
    assert.equal(detectBillingInterval('for the year'), 'year');
    assert.equal(detectBillingInterval('$4.00/mo'), 'month');
    assert.equal(detectBillingInterval('annual plan'), 'year');
  });

  it('converts annual to monthly', () => {
    assert.equal(toMonthlyAmount(60, 'year'), 5);
    assert.equal(toMonthlyAmount(12, 'month'), 12);
  });
});

describe('formatMoneyTotals', () => {
  it('sums same currency and separates mixed', () => {
    assert.equal(
      formatMoneyTotals([
        { monthly: 10, currency: 'USD' },
        { monthly: 5.5, currency: 'USD' },
      ]),
      '$15.50'
    );
    const mixed = formatMoneyTotals([
      { monthly: 10, currency: 'USD' },
      { monthly: 5, currency: 'EUR' },
    ]);
    assert.ok(mixed.includes('$10.00'));
    assert.ok(mixed.includes('+'));
  });
});

describe('parseMessage currency', () => {
  it('stores EUR on euro amounts', () => {
    const ins = parseMessage('Charge of €12.99 monthly', 'Service');
    assert.equal(ins.amount, 12.99);
    assert.equal(ins.currency, 'EUR');
    assert.match(ins.summary, /€|EUR/);
  });
});
