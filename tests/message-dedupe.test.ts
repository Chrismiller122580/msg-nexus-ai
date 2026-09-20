import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contentFingerprint,
  normalizeFrom,
  normalizeSubject,
  threadKey,
} from '../lib/message-dedupe';

describe('message-dedupe', () => {
  it('normalizes display-name emails', () => {
    assert.equal(normalizeFrom('Netflix <billing@netflix.com>'), 'billing@netflix.com');
    assert.equal(normalizeFrom('BILLING@Netflix.com'), 'billing@netflix.com');
  });

  it('strips reply prefixes from subjects', () => {
    assert.equal(normalizeSubject('Re: Re: Your receipt'), 'your receipt');
    assert.equal(normalizeSubject('FWD: Invoice'), 'invoice');
  });

  it('fingerprints Gmail vs SMS copies of the same bill', () => {
    const a = contentFingerprint({
      from: 'Netflix <billing@netflix.com>',
      subject: 'Your receipt',
      body: 'Your Netflix plan is $15.49 this month. https://netflix.com/account',
    });
    const b = contentFingerprint({
      from: 'billing@netflix.com',
      subject: 'RE: Your receipt',
      body: 'Your Netflix plan is $15.49 this month.',
    });
    assert.equal(a, b);
  });

  it('groups replies into the same thread key', () => {
    const a = threadKey({ from: 'a@x.com', subject: 'Lease', body: 'hi' });
    const b = threadKey({ from: 'A@x.com', subject: 'Re: Lease', body: 'ok' });
    assert.equal(a, b);
  });
});
