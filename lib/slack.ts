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

export async function getValidSlackToken(userId: number): Promise<string | null> {
  const db = getDb();
  const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
  return conn?.accessToken ?? null;
}

interface SlackMessage {
  ts: string;
  text?: string;
  user?: string;
}

export async function fetchRecentSlackMessages(accessToken: string, max = 20) {
  const channelsRes = await fetch('https://slack.com/api/conversations.list?types=im&limit=5', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const channelsData = await channelsRes.json() as { ok: boolean; channels?: Array<{ id: string }> };
  if (!channelsData.ok || !channelsData.channels?.length) return [];

  const results: Array<{ externalId: string; from: string; body: string; timestamp: string }> = [];

  for (const ch of channelsData.channels.slice(0, 3)) {
    const histRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${ch.id}&limit=${Math.ceil(max / 3)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const hist = await histRes.json() as { ok: boolean; messages?: SlackMessage[] };
    if (!hist.ok || !hist.messages) continue;

    for (const m of hist.messages) {
      if (!m.text) continue;
      results.push({
        externalId: `${ch.id}-${m.ts}`,
        from: m.user ? `Slack user ${m.user}` : 'Slack',
        body: m.text,
        timestamp: new Date(Number(m.ts) * 1000).toISOString(),
      });
    }
  }

  return results.slice(0, max);
}