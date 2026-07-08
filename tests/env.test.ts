import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL = { ...process.env };

describe('isDevMagicLinkAllowed', () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.ALLOW_DEV_MAGIC_LINK;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('is false unless explicitly enabled in development', async () => {
    process.env.NODE_ENV = 'development';
    const { isDevMagicLinkAllowed } = await import('../lib/env');
    assert.equal(isDevMagicLinkAllowed(), false);

    process.env.ALLOW_DEV_MAGIC_LINK = 'true';
    assert.equal(isDevMagicLinkAllowed(), true);
  });
});