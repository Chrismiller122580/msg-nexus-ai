import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestOrigin } from '@/lib/app-url';
import { getGmailAuthUrl, isGmailConfigured } from '@/lib/gmail';
import { OAUTH_COOKIE_OPTS } from '@/lib/oauth-cookies';
import { getCurrentUser } from '@/lib/session';
import { generateId } from '@/lib/utils';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/settings');
  }

  if (!isGmailConfigured()) {
    redirect('/settings?error=gmail-not-configured');
  }

  const origin = getRequestOrigin(request);
  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('gmail-oauth-state', state, OAUTH_COOKIE_OPTS);
  cookieStore.set('gmail-oauth-origin', origin, OAUTH_COOKIE_OPTS);

  redirect(getGmailAuthUrl(state, origin));
}