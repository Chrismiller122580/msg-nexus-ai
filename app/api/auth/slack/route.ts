import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestOrigin } from '@/lib/app-url';
import { OAUTH_COOKIE_OPTS } from '@/lib/oauth-cookies';
import { getSlackAuthUrl, isSlackConfigured } from '@/lib/slack';
import { getCurrentUser } from '@/lib/session';
import { generateId } from '@/lib/utils';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');
  if (!isSlackConfigured()) redirect('/settings?error=slack-not-configured');

  const origin = getRequestOrigin(request);
  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('slack-oauth-state', state, OAUTH_COOKIE_OPTS);
  cookieStore.set('slack-oauth-origin', origin, OAUTH_COOKIE_OPTS);

  redirect(getSlackAuthUrl(state, origin));
}