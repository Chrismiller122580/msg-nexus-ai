import { getDb, slackConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { getAppUrl } from '@/lib/app-url';

const SLACK_SCOPES = ['channels:history', 'im:history', 'users:read', 'users:read.email'].join(',');

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

export function getSlackAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: SLACK_SCOPES,
    redirect_uri: `${getAppUrl()}/api/auth/slack/callback`,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export async function exchangeSlackCode(code: string) {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${getAppUrl()}/api/auth/slack/callback`,
    }),
  });
  const data = await res.json() as {
    ok: boolean;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    team?: { id: string; name: string };
    authed_user?: { id: string; access_token?: string };
  };
  const token = data.authed_user?.access_token || data.access_token;
  if (!data.ok || !token) throw new Error('Slack OAuth failed');
  return { ...data, access_token: token };
}

export async function getSlackUser(accessToken: string) {
  const res = await fetch('https://slack.com/api/users.identity', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as { ok: boolean; user?: { name: string; email?: string } };
  return data.user?.name || data.user?.email || 'Slack user';
}

async function refreshSlackToken(refreshToken: string) {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json() as {
    ok: boolean;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.ok || !data.access_token) throw new Error('Failed to refresh Slack token');
  return data;
}

export async function getValidSlackToken(userId: number): Promise<string | null> {
  const db = getDb();
  const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
  if (!conn) return null;

  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return conn.accessToken;
  if (!conn.refreshToken) return conn.accessToken;

  const refreshed = await refreshSlackToken(conn.refreshToken);
  await db.update(slackConnections).set({
    accessToken: refreshed.access_token!,
    refreshToken: refreshed.refresh_token ?? conn.refreshToken,
    expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
  }).where(eq(slackConnections.userId, userId));

  return refreshed.access_token!;
}

interface SlackMessage {
  ts: string;
  text?: string;
  user?: string;
}

async function resolveSlackUserName(accessToken: string, userId: string): Promise<string> {
  const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as {
    ok: boolean;
    user?: { real_name?: string; name?: string; profile?: { display_name?: string } };
  };
  if (!data.ok || !data.user) return `Slack user ${userId}`;
  return data.user.profile?.display_name || data.user.real_name || data.user.name || `Slack user ${userId}`;
}

export async function fetchRecentSlackMessages(accessToken: string, max = 50) {
  const channelsRes = await fetch('https://slack.com/api/conversations.list?types=im&limit=8', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const channelsData = await channelsRes.json() as { ok: boolean; channels?: Array<{ id: string }> };
  if (!channelsData.ok || !channelsData.channels?.length) return [];

  const results: Array<{ externalId: string; from: string; body: string; timestamp: string }> = [];
  const userNameCache = new Map<string, string>();

  for (const ch of channelsData.channels.slice(0, 5)) {
    const histRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${ch.id}&limit=${Math.ceil(max / 5)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const hist = await histRes.json() as { ok: boolean; messages?: SlackMessage[] };
    if (!hist.ok || !hist.messages) continue;

    for (const m of hist.messages) {
      if (!m.text) continue;
      let from = 'Slack';
      if (m.user) {
        if (!userNameCache.has(m.user)) {
          userNameCache.set(m.user, await resolveSlackUserName(accessToken, m.user));
        }
        from = userNameCache.get(m.user)!;
      }
      results.push({
        externalId: `${ch.id}-${m.ts}`,
        from,
        body: m.text,
        timestamp: new Date(Number(m.ts) * 1000).toISOString(),
      });
    }
  }

  return results.slice(0, max);
}