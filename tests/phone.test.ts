import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, phonesMatch } from '../lib/phone';

describe('phonesMatch', () => {
  it('matches formatted US numbers', () => {
    assert.equal(phonesMatch('+1 (860) 392-9361', '+18603929361'), true);
    assert.equal(phonesMatch('8603929361', '18603929361'), true);
  });

  it('rejects different numbers', () => {
    assert.equal(phonesMatch('+15551234567', '+15559876543'), false);
  });
});

describe('normalizePhoneNumber', () => {
  it('normalizes US numbers', () => {
    assert.equal(normalizePhoneNumber('8603929361'), '+18603929361');
  });
});
