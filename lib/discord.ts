import { getDb, discordConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { getOAuthCallbackUrl } from '@/lib/app-url';

const DISCORD_SCOPES = ['identify', 'guilds', 'dm_channels.read'].join(' ');

export function isDiscordConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

export function getDiscordAuthUrl(state: string, appUrl?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: getOAuthCallbackUrl('discord', appUrl),
    response_type: 'code',
    scope: DISCORD_SCOPES,
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

export async function exchangeDiscordCode(code: string, appUrl?: string) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getOAuthCallbackUrl('discord', appUrl),
    }),
  });
  if (!res.ok) throw new Error('Discord OAuth failed');
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function getDiscordProfile(accessToken: string) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Discord profile');
  const data = await res.json() as { id: string; username: string; global_name?: string };
  return { id: data.id, name: data.global_name || data.username };
}

async function refreshDiscordToken(refreshToken: string) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Discord token');
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function getValidDiscordToken(userId: number): Promise<string | null> {
  const db = getDb();
  const [conn] = await db.select().from(discordConnections).where(eq(discordConnections.userId, userId)).limit(1);
  if (!conn) return null;

  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return conn.accessToken;
  if (!conn.refreshToken) return conn.accessToken;

  const refreshed = await refreshDiscordToken(conn.refreshToken);
  await db.update(discordConnections).set({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  }).where(eq(discordConnections.userId, userId));

  return refreshed.access_token;
}

export async function fetchRecentDiscordMessages(accessToken: string, max = 20) {
  const channelsRes = await fetch('https://discord.com/api/users/@me/channels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!channelsRes.ok) return [];

  const channels = await channelsRes.json() as Array<{ id: string; recipients?: Array<{ username: string }> }>;
  const results: Array<{ externalId: string; from: string; body: string; timestamp: string }> = [];

  for (const ch of channels.slice(0, 3)) {
    const msgRes = await fetch(`https://discord.com/api/channels/${ch.id}/messages?limit=${Math.ceil(max / 3)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!msgRes.ok) continue;
    const messages = await msgRes.json() as Array<{ id: string; content: string; timestamp: string; author?: { username: string } }>;
    for (const m of messages) {
      if (!m.content) continue;
      results.push({
        externalId: m.id,
        from: m.author?.username || ch.recipients?.[0]?.username || 'Discord',
        body: m.content,
        timestamp: m.timestamp,
      });
    }
  }

  return results.slice(0, max);
}