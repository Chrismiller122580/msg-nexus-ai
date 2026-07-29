import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMessage,
  findVendor,
  textHasAlias,
  parseFromField,
  PARSER_VERSION,
  isInsightStale,
  countAnalysisGaps,
} from '../lib/ai-parser';

describe('textHasAlias', () => {
  it('does not match short aliases inside longer words', () => {
    assert.equal(textHasAlias('last night: $41.75', 'gh'), false);
    assert.equal(textHasAlias('tonight we go', 'gh'), false);
    assert.equal(textHasAlias('spotlight on deals', 'spot'), false);
  });

  it('matches short aliases as whole tokens', () => {
    assert.equal(textHasAlias('from: gh <noreply@x.com>', 'gh'), true);
    assert.equal(textHasAlias('github pro plan', 'github'), true);
  });
});

describe('parseFromField', () => {
  it('extracts email and domain', () => {
    const p = parseFromField('GitHub <billing@github.com>');
    assert.equal(p.email, 'billing@github.com');
    assert.equal(p.domain, 'github.com');
    assert.match(p.display, /GitHub/i);
  });
});

describe('findVendor', () => {
  it('does not label Uber night message as GitHub', () => {
    const v = findVendor({
      from: 'Alex Rivera',
      body: 'Uber to the airport last night: $41.75. Can you cover next time?',
    });
    assert.notEqual(v, 'GitHub');
    assert.equal(v, 'Uber');
  });

  it('detects GitHub from sender domain and body', () => {
    assert.equal(
      findVendor({
        from: 'GitHub <billing@github.com>',
        body: 'You were charged $4.00 for GitHub Pro.',
      }),
      'GitHub'
    );
    assert.equal(
      findVendor({
        from: 'GitHub Bot',
        body: 'Your GitHub Pro subscription ($4.00/mo) will renew on the 28th.',
      }),
      'GitHub'
    );
  });

  it('prefers from/domain over weak body noise', () => {
    assert.equal(
      findVendor({
        from: 'Netflix <info@netflix.com>',
        subject: 'Your monthly subscription receipt',
        body: 'Thanks for being a member.',
      }),
      'Netflix'
    );
  });
});

describe('parseMessage', () => {
  it('does not create fake GitHub subscription from "night"', () => {
    const ins = parseMessage(
      'Uber to the airport last night: $41.75. Can you cover next time?',
      'Alex Rivera'
    );
    assert.notEqual(ins.vendor, 'GitHub');
    assert.notEqual(ins.category, 'subscription');
  });

  it('parses real GitHub Pro subscription', () => {
    const ins = parseMessage(
      'Your GitHub Pro subscription ($4.00/mo) will renew on the 28th. Update billing info here if needed.',
      'GitHub Bot'
    );
    assert.equal(ins.vendor, 'GitHub');
    assert.equal(ins.category, 'subscription');
    assert.equal(ins.amount, 4);
  });

  it('uses subject for vendor and amount when body is weak', () => {
    const ins = parseMessage(
      'See receipt details in your account.',
      'noreply@github.com',
      'GitHub Pro receipt — $4.00 charged'
    );
    assert.equal(ins.vendor, 'GitHub');
    assert.equal(ins.amount, 4);
  });

  it('does not invent due dates from dollar amounts', () => {
    const ins = parseMessage(
      'Your GitHub Pro subscription ($4.00/mo) will renew soon.',
      'GitHub Bot'
    );
    assert.ok(!ins.dueDate || !/on the 4/i.test(ins.dueDate));
  });

  it('extracts explicit due date still', () => {
    const ins = parseMessage(
      'Amount due: $142.87. Payment due June 20 to avoid late fee.',
      'Utility'
    );
    assert.ok(ins.dueDate);
    assert.match(ins.dueDate!, /June 20/i);
  });

  it('classifies phone/utility monthly bills as bill not subscription', () => {
    const phone = parseMessage(
      'Your monthly phone bill of $68.00 posted. Auto paid. Thanks for being a customer!',
      'T-Mobile'
    );
    assert.equal(phone.vendor, 'Phone');
    assert.equal(phone.category, 'bill');
    assert.equal(phone.amount, 68);

    const electric = parseMessage(
      'Your electric bill is ready. Amount due: $142.87. Pay by June 20.',
      'SMS Alerts'
    );
    assert.equal(electric.category, 'bill');

    const xfinity = parseMessage(
      'Internet + TV: $109.00 is due by June 25. Auto-pay is on.',
      'Xfinity <no-reply@xfinity.com>',
      'June statement for your Xfinity account'
    );
    assert.equal(xfinity.category, 'bill');
  });

  it('keeps SaaS renewals as subscriptions', () => {
    const netflix = parseMessage(
      'Your subscription for Netflix Standard was billed $15.49. Recurring monthly charge.',
      'Netflix <info@netflix.com>'
    );
    assert.equal(netflix.category, 'subscription');
    assert.equal(netflix.vendor, 'Netflix');
  });

  it('stamps parserVersion and marks old insights stale', () => {
    const ins = parseMessage('GitHub Pro $4/mo subscription', 'GitHub Bot');
    assert.equal(ins.parserVersion, PARSER_VERSION);
    assert.equal(isInsightStale(ins), false);
    assert.equal(isInsightStale({ ...ins, parserVersion: 1 }), true);
    assert.equal(isInsightStale({ ...ins, parserVersion: undefined }), true);

    const gaps = countAnalysisGaps(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      {
        a: ins,
        b: { ...ins, messageId: 'b', parserVersion: 1 },
      }
    );
    assert.deepEqual(gaps, { unparsed: 1, stale: 1, current: 1 });
  });
});
