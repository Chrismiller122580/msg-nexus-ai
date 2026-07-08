import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestOrigin } from '@/lib/app-url';
import { getMicrosoftAuthUrl, isMicrosoftConfigured } from '@/lib/microsoft';
import { OAUTH_COOKIE_OPTS } from '@/lib/oauth-cookies';
import { getCurrentUser } from '@/lib/session';
import { generateId } from '@/lib/utils';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/settings');
  }

  if (!isMicrosoftConfigured()) {
    redirect('/settings?error=outlook-not-configured');
  }

  const origin = getRequestOrigin(request);
  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('microsoft-oauth-state', state, OAUTH_COOKIE_OPTS);
  cookieStore.set('microsoft-oauth-origin', origin, OAUTH_COOKIE_OPTS);

  redirect(getMicrosoftAuthUrl(state, origin));
}