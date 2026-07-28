import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  resolveTwilioSyncLine,
  getTwilioEnvPhoneNumber,
} from '../lib/twilio';

describe('normalizePhoneNumber (twilio re-export)', () => {
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

describe('resolveTwilioSyncLine', () => {
  const orig = process.env.TWILIO_PHONE_NUMBER;

  afterEach(() => {
    if (orig === undefined) delete process.env.TWILIO_PHONE_NUMBER;
    else process.env.TWILIO_PHONE_NUMBER = orig;
  });

  it('prefers env TWILIO_PHONE_NUMBER over connected phone', () => {
    process.env.TWILIO_PHONE_NUMBER = '+1 (555) 999-0000';
    assert.equal(resolveTwilioSyncLine('+15551112222'), '+15559990000');
    assert.equal(getTwilioEnvPhoneNumber(), '+15559990000');
  });

  it('falls back to connected phone when env unset', () => {
    delete process.env.TWILIO_PHONE_NUMBER;
    assert.equal(resolveTwilioSyncLine('555-123-4567'), '+15551234567');
    assert.equal(getTwilioEnvPhoneNumber(), null);
  });
});
