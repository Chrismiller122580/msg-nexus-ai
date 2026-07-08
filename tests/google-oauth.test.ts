import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL = { ...process.env };

describe('google oauth env', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_SECRETE;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('reads GOOGLE_CLIENT_SECRET', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    const { isGoogleOAuthConfigured, getGoogleClientSecret } = await import('../lib/google-oauth');
    assert.equal(getGoogleClientSecret(), 'secret');
    assert.equal(isGoogleOAuthConfigured(), true);
  });

  it('falls back to GOOGLE_CLIENT_SECRETE typo', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRETE = 'typo-secret';
    const { isGoogleOAuthConfigured, getGoogleClientSecret } = await import('../lib/google-oauth');
    assert.equal(getGoogleClientSecret(), 'typo-secret');
    assert.equal(isGoogleOAuthConfigured(), true);
  });
});