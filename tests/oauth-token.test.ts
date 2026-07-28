import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  discordSnowflakeAfter,
  formatGmailAfterQuery,
  formatSlackOldest,
  isOAuthTokenError,
  isTokenFresh,
  OAuthTokenError,
  resolveAccessToken,
  syncErrorResult,
} from '../lib/oauth-token';

describe('oauth-token helpers', () => {
  it('isTokenFresh respects skew window', () => {
    assert.equal(isTokenFresh(null), false);
    assert.equal(isTokenFresh(new Date(Date.now() + 120_000)), true);
    assert.equal(isTokenFresh(new Date(Date.now() + 10_000)), false);
    assert.equal(isTokenFresh(new Date(Date.now() - 1000)), false);
  });

  it('formatGmailAfterQuery uses yyyy/mm/dd (Gmail day precision)', () => {
    const d = new Date('2024-06-15T12:00:00.000Z');
    // 1s buffer stays on the same UTC day
    assert.equal(formatGmailAfterQuery(d), 'after:2024/06/15');
    // just after midnight UTC still maps to previous day after buffer
    assert.equal(formatGmailAfterQuery(new Date('2024-06-15T00:00:00.500Z')), 'after:2024/06/14');
  });

  it('formatSlackOldest returns unix seconds string', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    assert.equal(formatSlackOldest(d), '1704067200');
  });

  it('discordSnowflakeAfter produces a numeric snowflake string', () => {
    const d = new Date('2020-01-01T00:00:00.000Z');
    const snowflake = discordSnowflakeAfter(d);
    assert.match(snowflake, /^\d+$/);
    assert.ok(BigInt(snowflake) > BigInt(0));
  });

  it('resolveAccessToken returns fresh token without refresh', async () => {
    let refreshed = false;
    const token = await resolveAccessToken({
      provider: 'Test',
      accessToken: 'live',
      refreshToken: 'r',
      expiresAt: new Date(Date.now() + 3600_000),
      refresh: async () => {
        refreshed = true;
        return { access_token: 'new', expires_in: 3600 };
      },
      persist: async () => {},
    });
    assert.equal(token, 'live');
    assert.equal(refreshed, false);
  });

  it('resolveAccessToken refreshes near-expiry tokens and persists', async () => {
    let persisted: { accessToken: string; expiresAt: Date | null } | null = null;
    const token = await resolveAccessToken({
      provider: 'Test',
      accessToken: 'old',
      refreshToken: 'r',
      expiresAt: new Date(Date.now() + 10_000),
      refresh: async () => ({ access_token: 'new', expires_in: 3600, refresh_token: 'r2' }),
      persist: async (t) => {
        persisted = t;
      },
    });
    assert.equal(token, 'new');
    assert.equal(persisted?.accessToken, 'new');
    assert.ok(persisted?.expiresAt instanceof Date);
  });

  it('resolveAccessToken throws when expired without refresh token', async () => {
    await assert.rejects(
      () =>
        resolveAccessToken({
          provider: 'Gmail',
          accessToken: 'old',
          refreshToken: null,
          expiresAt: new Date(Date.now() - 1000),
          refresh: async () => ({ access_token: 'x' }),
          persist: async () => {},
        }),
      (err: unknown) => {
        assert.ok(isOAuthTokenError(err));
        assert.equal((err as OAuthTokenError).code, 'expired');
        assert.match((err as OAuthTokenError).message, /Reconnect/);
        return true;
      }
    );
  });

  it('resolveAccessToken maps refresh failures to reconnect errors', async () => {
    await assert.rejects(
      () =>
        resolveAccessToken({
          provider: 'Outlook',
          accessToken: 'old',
          refreshToken: 'r',
          expiresAt: new Date(Date.now() - 1000),
          refresh: async () => {
            throw new Error('network');
          },
          persist: async () => {},
        }),
      (err: unknown) => {
        assert.ok(isOAuthTokenError(err));
        assert.equal((err as OAuthTokenError).code, 'refresh_failed');
        return true;
      }
    );
  });

  it('syncErrorResult normalizes OAuth and generic errors', () => {
    const oauth = syncErrorResult(new OAuthTokenError('Gmail', 'expired'));
    assert.equal(oauth.imported, 0);
    assert.match(oauth.error, /Gmail/);

    const generic = syncErrorResult(new Error('boom'));
    assert.equal(generic.error, 'boom');
  });
});
