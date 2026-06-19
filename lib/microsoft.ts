import { getDb, outlookConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { getAppUrl } from '@/lib/app-url';

const MICROSOFT_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'Mail.Read',
  'User.Read',
].join(' ');

export function isMicrosoftConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export function getMicrosoftAuthUrl(state: string): string {
  const redirectUri = `${getAppUrl()}/api/auth/microsoft/callback`;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: MICROSOFT_SCOPES,
    response_mode: 'query',
    state,
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeMicrosoftCode(code: string) {
  const redirectUri = `${getAppUrl()}/api/auth/microsoft/callback`;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to exchange Microsoft authorization code');
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

export async function getMicrosoftProfile(accessToken: string) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Microsoft profile');
  const data = await res.json() as { mail?: string; userPrincipalName?: string };
  return { email: data.mail || data.userPrincipalName || 'outlook@user' };
}

async function refreshMicrosoftToken(refreshToken: string) {
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Microsoft token');
  return res.json() as Promise<{ access_token: string; expires_in: number; refresh_token?: string }>;
}

export async function getValidMicrosoftToken(userId: number): Promise<string | null> {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(outlookConnections)
    .where(eq(outlookConnections.userId, userId))
    .limit(1);

  if (!conn) return null;

  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return conn.accessToken;
  }

  if (!conn.refreshToken) return conn.accessToken;

  const refreshed = await refreshMicrosoftToken(conn.refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await db
    .update(outlookConnections)
    .set({
      accessToken: refreshed.access_token,
      expiresAt: newExpiresAt,
      refreshToken: refreshed.refresh_token ?? conn.refreshToken,
    })
    .where(eq(outlookConnections.userId, userId));

  return refreshed.access_token;
}

interface GraphMessage {
  id: string;
  receivedDateTime?: string;
  subject?: string;
  bodyPreview?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
}

export async function fetchRecentOutlookMessages(accessToken: string, max = 20) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$top=${max}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,receivedDateTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error('Failed to list Outlook messages');

  const data = await res.json() as { value?: GraphMessage[] };
  if (!data.value?.length) return [];

  return data.value.map((msg) => {
    const fromName = msg.from?.emailAddress?.name;
    const fromAddr = msg.from?.emailAddress?.address;
    const from = fromName && fromAddr ? `${fromName} <${fromAddr}>` : fromAddr || fromName || 'Unknown';
    return {
      externalId: msg.id,
      from,
      subject: msg.subject,
      body: (msg.bodyPreview || msg.subject || '(empty message)').slice(0, 4000),
      timestamp: msg.receivedDateTime || new Date().toISOString(),
    };
  });
}