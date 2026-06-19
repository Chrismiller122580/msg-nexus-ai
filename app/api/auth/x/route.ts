import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { generatePkce, getXAuthUrl, isXConfigured } from '@/lib/x-api';
import { generateId } from '@/lib/utils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');
  if (!isXConfigured()) redirect('/settings?error=x-not-configured');

  const state = generateId() + generateId();
  const { verifier, challenge } = generatePkce();
  const cookieStore = await cookies();
  cookieStore.set('x-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  cookieStore.set('x-pkce-verifier', verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  redirect(getXAuthUrl(state, challenge));
}