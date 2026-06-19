import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, discordConnections } from '@/db';
import { getCurrentUser } from '@/lib/session';
import { exchangeDiscordCode, getDiscordProfile } from '@/lib/discord';
import { syncDiscordForUser } from '@/lib/discord-sync';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const savedState = cookieStore.get('discord-oauth-state')?.value;
  cookieStore.delete('discord-oauth-state');

  if (!code || !state || !savedState || state !== savedState) {
    redirect('/settings?error=discord-auth-failed');
  }

  let success = false;
  try {
    const tokens = await exchangeDiscordCode(code);
    const profile = await getDiscordProfile(tokens.access_token);
    const db = getDb();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existing = await db.select().from(discordConnections).where(eq(discordConnections.userId, user.id)).limit(1);
    const values = {
      discordUserId: profile.id,
      userName: profile.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    };

    if (existing.length > 0) {
      await db.update(discordConnections).set(values).where(eq(discordConnections.userId, user.id));
    } else {
      await db.insert(discordConnections).values({ userId: user.id, ...values });
    }

    await syncDiscordForUser(user.id);
    success = true;
  } catch (err) {
    console.error('Discord callback error:', err);
  }

  redirect(success ? '/settings?discord=connected' : '/settings?error=discord-auth-failed');
}