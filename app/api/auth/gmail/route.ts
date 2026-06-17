import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getGmailAuthUrl, isGmailConfigured } from '@/lib/gmail';
import { generateId } from '@/lib/utils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/settings');
  }

  if (!isGmailConfigured()) {
    redirect('/settings?error=gmail-not-configured');
  }

  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('gmail-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  redirect(getGmailAuthUrl(state));
}