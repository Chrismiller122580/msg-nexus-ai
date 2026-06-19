import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getMicrosoftAuthUrl, isMicrosoftConfigured } from '@/lib/microsoft';
import { generateId } from '@/lib/utils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/settings');
  }

  if (!isMicrosoftConfigured()) {
    redirect('/settings?error=outlook-not-configured');
  }

  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('microsoft-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  redirect(getMicrosoftAuthUrl(state));
}