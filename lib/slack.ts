import { getDb, slackConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { getOAuthCallbackUrl } from '@/lib/app-url';
import {
  formatSlackOldest,
  OAuthTokenError,
  resolveAccessToken,
} from '@/lib/oauth-token';

const SLACK_SCOPES = ['channels:history', 'im:history', 'users:read', 'users:read.email'].join(',');

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

export function getSlackAuthUrl(state: string, appUrl?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: SLACK_SCOPES,
    redirect_uri: getOAuthCallbackUrl('slack', appUrl),
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export async function exchangeSlackCode(code: string, appUrl?: string) {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: getOAuthCallbackUrl('slack', appUrl),
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
  if (!data.ok || !data.access_token) throw new OAuthTokenError('Slack', 'refresh_failed');
  return data;
}

export async function getValidSlackToken(
  userId: number,
  opts?: { forceRefresh?: boolean }
): Promise<string | null> {
  const db = getDb();
  const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
  if (!conn) return null;

  return resolveAccessToken({
    provider: 'Slack',
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    expiresAt: conn.expiresAt,
    forceRefresh: opts?.forceRefresh,
    refresh: async () => {
      const refreshed = await refreshSlackToken(conn.refreshToken!);
      return {
        access_token: refreshed.access_token!,
        expires_in: refreshed.expires_in,
        refresh_token: refreshed.refresh_token,
      };
    },
    persist: async ({ accessToken, expiresAt, refreshToken }) => {
      await db.update(slackConnections).set({
        accessToken,
        refreshToken: refreshToken ?? conn.refreshToken,
        expiresAt,
      }).where(eq(slackConnections.userId, userId));
    },
  });
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

export async function fetchRecentSlackMessages(
  accessToken: string,
  max = 50,
  since?: Date | null
) {
  const channelsRes = await fetch('https://slack.com/api/conversations.list?types=im&limit=8', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const channelsData = await channelsRes.json() as {
    ok: boolean;
    error?: string;
    channels?: Array<{ id: string }>;
  };
  if (channelsData.error === 'invalid_auth' || channelsData.error === 'token_revoked') {
    throw new OAuthTokenError('Slack', 'expired');
  }
  if (!channelsData.ok || !channelsData.channels?.length) return [];

  const results: Array<{ externalId: string; from: string; body: string; timestamp: string }> = [];
  const userNameCache = new Map<string, string>();
  const oldest = since ? formatSlackOldest(new Date(since.getTime() - 1000)) : null;

  for (const ch of channelsData.channels.slice(0, 5)) {
    const histParams = new URLSearchParams({
      channel: ch.id,
      limit: String(Math.ceil(max / 5)),
    });
    if (oldest) histParams.set('oldest', oldest);

    const histRes = await fetch(
      `https://slack.com/api/conversations.history?${histParams}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const hist = await histRes.json() as {
      ok: boolean;
      error?: string;
      messages?: SlackMessage[];
    };
    if (hist.error === 'invalid_auth' || hist.error === 'token_revoked') {
      throw new OAuthTokenError('Slack', 'expired');
    }
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