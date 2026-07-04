import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber } from '../lib/twilio';

describe('normalizePhoneNumber', () => {
  it('adds US country code for 10-digit numbers', () => {
    assert.equal(normalizePhoneNumber('5551234567'), '+15551234567');
  });

  it('preserves E.164 with leading plus', () => {
    assert.equal(normalizePhoneNumber('+44 7911 123456'), '+447911123456');
  });

  it('handles 11-digit US numbers', () => {
    assert.equal(normalizePhoneNumber('15551234567'), '+15551234567');
  });
});