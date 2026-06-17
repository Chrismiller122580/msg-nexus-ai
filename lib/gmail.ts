import { getDb, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { getAppUrl } from '@/lib/app-url';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function isGmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGmailAuthUrl(state: string): string {
  const redirectUri = `${getAppUrl()}/api/auth/gmail/callback`;
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

export async function exchangeGmailCode(code: string) {
  const redirectUri = `${getAppUrl()}/api/auth/gmail/callback`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
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
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Gmail token');
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getValidAccessToken(userId: number): Promise<string | null> {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);

  if (!conn) return null;

  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return conn.accessToken;
  }

  if (!conn.refreshToken) return conn.accessToken;

  const refreshed = await refreshAccessToken(conn.refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await db
    .update(gmailConnections)
    .set({ accessToken: refreshed.access_token, expiresAt: newExpiresAt })
    .where(eq(gmailConnections.userId, userId));

  return refreshed.access_token;
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

export async function fetchRecentGmailMessages(accessToken: string, max = 20) {
  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error('Failed to list Gmail messages');

  const list = (await listRes.json()) as GmailMessageList;
  if (!list.messages?.length) return [];

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

    results.push({
      externalId: msg.id,
      from,
      subject,
      body: body || subject || '(empty message)',
      timestamp: msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : new Date().toISOString(),
    });
  }

  return results;
}
