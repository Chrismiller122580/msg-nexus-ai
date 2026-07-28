import { getDb, gmailConnections } from '@/db';
import { and, eq } from 'drizzle-orm';
import { getOAuthCallbackUrl } from '@/lib/app-url';
import { getGoogleClientSecret, isGoogleOAuthConfigured } from '@/lib/google-oauth';
import {
  formatGmailAfterQuery,
  OAuthTokenError,
  resolveAccessToken,
} from '@/lib/oauth-token';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function isGmailConfigured(): boolean {
  return isGoogleOAuthConfigured();
}

export function getGmailAuthUrl(state: string, appUrl?: string): string {
  const redirectUri = getOAuthCallbackUrl('gmail', appUrl);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function gmailApiError(res: Response, fallback: string): Promise<Error> {
  let detail = '';
  try {
    const body = (await res.json()) as {
      error?: { message?: string; status?: string } | string;
      error_description?: string;
    };
    if (typeof body.error === 'string') {
      detail = body.error_description || body.error;
    } else if (body.error?.message) {
      detail = body.error.message;
    }
  } catch {
    /* ignore parse errors */
  }
  const suffix = detail ? `: ${detail}` : ` (HTTP ${res.status})`;
  return new Error(`${fallback}${suffix}`);
}

export async function exchangeGmailCode(code: string, appUrl?: string) {
  const redirectUri = getOAuthCallbackUrl('gmail', appUrl);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: getGoogleClientSecret()!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    throw await gmailApiError(res, 'Failed to exchange Gmail authorization code');
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

export async function getGmailProfile(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw await gmailApiError(res, 'Failed to fetch Gmail profile');
  return res.json() as Promise<{ emailAddress: string }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: getGoogleClientSecret()!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new OAuthTokenError('Gmail', 'refresh_failed');
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getValidAccessToken(
  userId: number,
  opts?: { forceRefresh?: boolean; connectionId?: number }
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(gmailConnections)
    .where(
      opts?.connectionId
        ? and(eq(gmailConnections.userId, userId), eq(gmailConnections.id, opts.connectionId))
        : eq(gmailConnections.userId, userId)
    )
    .limit(1);

  const conn = rows[0];
  if (!conn) return null;

  return resolveAccessToken({
    provider: 'Gmail',
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    expiresAt: conn.expiresAt,
    forceRefresh: opts?.forceRefresh,
    refresh: () => refreshAccessToken(conn.refreshToken!),
    persist: async ({ accessToken, expiresAt }) => {
      await db
        .update(gmailConnections)
        .set({ accessToken, expiresAt })
        .where(eq(gmailConnections.id, conn.id));
    },
  });
}

interface GmailMessageList {
  messages?: Array<{ id: string }>;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: Array<{ name: string; value: string }>;
}

interface GmailMessagePayload {
  id: string;
  internalDate?: string;
  payload?: GmailPart;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return '';
  if (payload.body?.data && (!payload.parts || payload.parts.length === 0)) {
    const raw = decodeBase64Url(payload.body.data);
    return payload.mimeType === 'text/html' ? raw.replace(/<[^>]+>/g, ' ') : raw;
  }
  const textPart = payload.parts?.find((p) => p.mimeType === 'text/plain' && p.body?.data);
  if (textPart?.body?.data) return decodeBase64Url(textPart.body.data);
  const htmlPart = payload.parts?.find((p) => p.mimeType === 'text/html' && p.body?.data);
  if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data).replace(/<[^>]+>/g, ' ');
  // Nested multiparts (e.g. multipart/alternative inside multipart/mixed)
  for (const part of payload.parts || []) {
    const nested = extractBody(part);
    if (nested) return nested;
  }
  return '';
}

function headerValue(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

const FETCH_CONCURRENCY = 8;

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export async function fetchRecentGmailMessages(
  accessToken: string,
  max = 50,
  since?: Date | null
) {
  const params = new URLSearchParams({ maxResults: String(max) });
  // Prefer inbox mail so connect/sync always has something useful to show
  params.set('labelIds', 'INBOX');
  if (since) params.set('q', formatGmailAfterQuery(since));

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (listRes.status === 401) {
    throw new OAuthTokenError('Gmail', 'expired');
  }
  if (!listRes.ok) {
    throw await gmailApiError(listRes, 'Failed to list Gmail messages');
  }

  const list = (await listRes.json()) as GmailMessageList;
  if (!list.messages?.length) return [];

  const sinceMs = since ? since.getTime() - 1000 : 0;

  const fetched = await mapPool(list.messages, FETCH_CONCURRENCY, async (item) => {
    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) return null;

    const msg = (await msgRes.json()) as GmailMessagePayload;
    const headers = msg.payload?.headers || [];
    const from = headerValue(headers, 'From') || 'Unknown';
    const subject = headerValue(headers, 'Subject');
    const body = extractBody(msg.payload).trim().slice(0, 4000);
    const timestamp = msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString();

    if (sinceMs && new Date(timestamp).getTime() < sinceMs) return null;

    return {
      externalId: msg.id,
      from,
      subject,
      body: body || subject || '(empty message)',
      timestamp,
    };
  });

  return fetched.filter((m): m is NonNullable<typeof m> => m != null);
}
