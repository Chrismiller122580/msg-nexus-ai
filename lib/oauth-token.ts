/** Shared OAuth access-token helpers for connector sync. */

export type OAuthTokenErrorCode = 'expired' | 'refresh_failed' | 'not_connected';

export class OAuthTokenError extends Error {
  readonly code: OAuthTokenErrorCode;
  readonly provider: string;

  constructor(provider: string, code: OAuthTokenErrorCode, message?: string) {
    super(
      message ??
        (code === 'not_connected'
          ? `${provider} is not connected.`
          : `${provider} session expired. Reconnect in Settings.`)
    );
    this.name = 'OAuthTokenError';
    this.code = code;
    this.provider = provider;
  }
}

export function isOAuthTokenError(err: unknown): err is OAuthTokenError {
  return err instanceof OAuthTokenError;
}

/** True if token is still usable (not expiring within skewMs). Missing expiry = unknown (not fresh). */
export function isTokenFresh(
  expiresAt: Date | string | null | undefined,
  skewMs = 60_000
): boolean {
  if (expiresAt == null) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now() + skewMs;
}

/**
 * Resolve a stored OAuth access token, refreshing when near expiry.
 * - No connection → null (caller maps to "not connected")
 * - Expired with no refresh token → OAuthTokenError expired
 * - Refresh failure → OAuthTokenError refresh_failed
 * - No expiry recorded and no refresh → return access token (long-lived tokens)
 */
export async function resolveAccessToken(options: {
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | string | null;
  refresh: () => Promise<{
    access_token: string;
    expires_in?: number;
    refresh_token?: string | null;
  }>;
  persist: (tokens: {
    accessToken: string;
    expiresAt: Date | null;
    refreshToken?: string | null;
  }) => Promise<void>;
  forceRefresh?: boolean;
}): Promise<string> {
  const {
    provider,
    accessToken,
    refreshToken,
    expiresAt,
    refresh,
    persist,
    forceRefresh = false,
  } = options;

  const hasExpiry = expiresAt != null;
  const fresh = isTokenFresh(expiresAt);

  if (!forceRefresh && fresh) {
    return accessToken;
  }

  // Long-lived token with no expiry and no refresh needed
  if (!forceRefresh && !hasExpiry && !refreshToken) {
    return accessToken;
  }

  if (!refreshToken) {
    if (!hasExpiry) return accessToken;
    throw new OAuthTokenError(provider, 'expired');
  }

  try {
    const refreshed = await refresh();
    const newExpiresAt =
      refreshed.expires_in != null
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null;

    await persist({
      accessToken: refreshed.access_token,
      expiresAt: newExpiresAt,
      refreshToken: refreshed.refresh_token ?? refreshToken,
    });

    return refreshed.access_token;
  } catch (err) {
    if (err instanceof OAuthTokenError) throw err;
    throw new OAuthTokenError(
      provider,
      'refresh_failed',
      `${provider} session expired. Reconnect in Settings.`
    );
  }
}

/** Standard connector sync result. */
export type SyncResult = {
  imported: number;
  error?: string;
  info?: string;
};

/** Map sync failures into a stable { imported, error } result. */
export function syncErrorResult(err: unknown, fallback = 'Sync failed'): SyncResult {
  if (isOAuthTokenError(err)) {
    return { imported: 0, error: err.message };
  }
  if (err instanceof Error && err.message) {
    return { imported: 0, error: err.message };
  }
  return { imported: 0, error: fallback };
}

/**
 * Gmail search `after:` is day-precision (`yyyy/mm/dd`), not epoch seconds.
 * Use the UTC calendar day of `since` (minus a tiny buffer so boundary mail
 * is included). Finer filtering is done client-side; ingest dedupes.
 */
export function formatGmailAfterQuery(since: Date): string {
  const d = new Date(since.getTime() - 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `after:${y}/${m}/${day}`;
}

/** Slack conversations.history `oldest` is unix seconds as a string. */
export function formatSlackOldest(since: Date): string {
  return String(Math.floor(since.getTime() / 1000));
}

/**
 * Discord message IDs are snowflakes. Convert a timestamp to a snowflake
 * so we can request messages after `since`.
 * Discord epoch: 2015-01-01T00:00:00.000Z
 */
export function discordSnowflakeAfter(since: Date): string {
  const DISCORD_EPOCH = 1_420_070_400_000;
  const ms = Math.max(0, since.getTime() - DISCORD_EPOCH);
  // snowflake = (ms << 22) — avoid BigInt literals for broader TS targets
  const id = BigInt(ms) << BigInt(22);
  return id.toString();
}
