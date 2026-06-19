import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getDiscordAuthUrl, isDiscordConfigured } from '@/lib/discord';
import { generateId } from '@/lib/utils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');
  if (!isDiscordConfigured()) redirect('/settings?error=discord-not-configured');

  const state = generateId() + generateId();
  const cookieStore = await cookies();
  cookieStore.set('discord-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  redirect(getDiscordAuthUrl(state));
}