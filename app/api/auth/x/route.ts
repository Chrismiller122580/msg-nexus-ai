import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestOrigin } from '@/lib/app-url';
import { OAUTH_COOKIE_OPTS } from '@/lib/oauth-cookies';
import { getCurrentUser } from '@/lib/session';
import { generatePkce, getXAuthUrl, isXConfigured } from '@/lib/x-api';
import { generateId } from '@/lib/utils';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');
  if (!isXConfigured()) redirect('/settings?error=x-not-configured');

  const origin = getRequestOrigin(request);
  const state = generateId() + generateId();
  const { verifier, challenge } = generatePkce();
  const cookieStore = await cookies();
  cookieStore.set('x-oauth-state', state, OAUTH_COOKIE_OPTS);
  cookieStore.set('x-pkce-verifier', verifier, OAUTH_COOKIE_OPTS);
  cookieStore.set('x-oauth-origin', origin, OAUTH_COOKIE_OPTS);

  redirect(getXAuthUrl(state, challenge, origin));
}