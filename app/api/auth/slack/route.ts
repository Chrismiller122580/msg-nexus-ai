import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getSlackAuthUrl, isSlackConfigured } from '@/lib/slack';
import { generateId } from '@/lib/utils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');
  if (!isSlackConfigured()) redirect('/settings?error=slack-not-configured');

  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('slack-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  redirect(getSlackAuthUrl(state));
}