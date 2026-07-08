import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL = { ...process.env };

describe('getDatabaseUrl', () => {
  beforeEach(() => {
    for (const key of [
      'DATABASE_URL',
      'POSTGRES_URL',
      'POSTGRES_URL_NON_POOLING',
      'POSTGRES_URL_NO_SSL',
      'NEON_DATABASE_URL',
      'USE_NEON',
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('prefers DATABASE_URL when set', async () => {
    process.env.DATABASE_URL = 'postgresql://primary/db';
    const { getDatabaseUrl } = await import('../lib/database-url');
    assert.equal(getDatabaseUrl(), 'postgresql://primary/db');
  });

  it('falls back to POSTGRES_URL_NO_SSL from Vercel Neon', async () => {
    process.env.POSTGRES_URL_NO_SSL = 'postgresql://neon/db';
    const { getDatabaseUrl } = await import('../lib/database-url');
    assert.equal(getDatabaseUrl(), 'postgresql://neon/db');
  });
});