import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestOrigin } from '@/lib/app-url';
import { getDiscordAuthUrl, isDiscordConfigured } from '@/lib/discord';
import { OAUTH_COOKIE_OPTS } from '@/lib/oauth-cookies';
import { getCurrentUser } from '@/lib/session';
import { generateId } from '@/lib/utils';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');
  if (!isDiscordConfigured()) redirect('/settings?error=discord-not-configured');

  const origin = getRequestOrigin(request);
  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('discord-oauth-state', state, OAUTH_COOKIE_OPTS);
  cookieStore.set('discord-oauth-origin', origin, OAUTH_COOKIE_OPTS);

  redirect(getDiscordAuthUrl(state, origin));
}