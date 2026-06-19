import { getDb, xConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { getAppUrl } from '@/lib/app-url';
import crypto from 'crypto';

const X_SCOPES = ['dm.read', 'tweet.read', 'users.read', 'offline.access'].join(' ');

export function isXConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

export function getXAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: `${getAppUrl()}/api/auth/x/callback`,
    scope: X_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export async function exchangeXCode(code: string, codeVerifier: string) {
  const credentials = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${getAppUrl()}/api/auth/x/callback`,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error('X OAuth failed');
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function getXProfile(accessToken: string) {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch X profile');
  const data = await res.json() as { data?: { id: string; username: string; name?: string } };
  return { id: data.data?.id || '0', name: data.data?.name || data.data?.username || 'X user' };
}

async function refreshXToken(refreshToken: string) {
  const credentials = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh X token');
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function getValidXToken(userId: number): Promise<string | null> {
  const db = getDb();
  const [conn] = await db.select().from(xConnections).where(eq(xConnections.userId, userId)).limit(1);
  if (!conn) return null;

  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return conn.accessToken;
  if (!conn.refreshToken) return conn.accessToken;

  const refreshed = await refreshXToken(conn.refreshToken);
  await db.update(xConnections).set({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  }).where(eq(xConnections.userId, userId));

  return refreshed.access_token;
}

export async function fetchRecentXDMs(accessToken: string, max = 20) {
  const eventsRes = await fetch(
    `https://api.twitter.com/2/dm_events?dm_event.fields=created_at,text,sender_id&max_results=${max}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!eventsRes.ok) return [];

  const data = await eventsRes.json() as {
    data?: Array<{ id: string; text?: string; created_at?: string; sender_id?: string }>;
  };

  return (data.data || []).map((e) => ({
    externalId: e.id,
    from: e.sender_id ? `X user ${e.sender_id}` : 'X',
    body: e.text || '(empty DM)',
    timestamp: e.created_at || new Date().toISOString(),
  }));
}