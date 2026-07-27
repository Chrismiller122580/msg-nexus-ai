import { getDb, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';
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
    throw new Error('Failed to exchange Gmail authorization code');
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
  if (!res.ok) throw new Error('Failed to fetch Gmail profile');
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
  opts?: { forceRefresh?: boolean }
): Promise<string | null> {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);

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
        .where(eq(gmailConnections.userId, userId));
    },
  });
}

interface GmailMessageList {
  messages?: Array<{ id: string }>;
}

interface GmailMessagePayload {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
  };
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function extractBody(payload: GmailMessagePayload['payload']): string {
  if (!payload) return '';
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  const textPart = payload.parts?.find((p) => p.mimeType === 'text/plain');
  if (textPart?.body?.data) return decodeBase64Url(textPart.body.data);
  const htmlPart = payload.parts?.find((p) => p.mimeType === 'text/html');
  if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data).replace(/<[^>]+>/g, ' ');
  return '';
}

export async function fetchRecentGmailMessages(
  accessToken: string,
  max = 50,
  since?: Date | null
) {
  const params = new URLSearchParams({ maxResults: String(max) });
  if (since) params.set('q', formatGmailAfterQuery(since));

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (listRes.status === 401) {
    throw new OAuthTokenError('Gmail', 'expired');
  }
  if (!listRes.ok) throw new Error('Failed to list Gmail messages');

  const list = (await listRes.json()) as GmailMessageList;
  if (!list.messages?.length) return [];

  const sinceMs = since ? since.getTime() - 1000 : 0;
  const results = [];
  for (const item of list.messages) {
    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) continue;

    const msg = (await msgRes.json()) as GmailMessagePayload;
    const headers = msg.payload?.headers || [];
    const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find((h) => h.name === 'Subject')?.value;
    const body = extractBody(msg.payload).trim().slice(0, 4000);
    const timestamp = msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString();

    if (sinceMs && new Date(timestamp).getTime() < sinceMs) continue;

    results.push({
      externalId: msg.id,
      from,
      subject,
      body: body || subject || '(empty message)',
      timestamp,
    });
  }

  return results;
}
