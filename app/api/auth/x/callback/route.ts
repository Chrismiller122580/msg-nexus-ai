import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, xConnections } from '@/db';
import { getCurrentUser } from '@/lib/session';
import { exchangeXCode, getXProfile } from '@/lib/x-api';
import { syncXForUser } from '@/lib/x-sync';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const savedState = cookieStore.get('x-oauth-state')?.value;
  const verifier = cookieStore.get('x-pkce-verifier')?.value;
  cookieStore.delete('x-oauth-state');
  cookieStore.delete('x-pkce-verifier');

  if (!code || !state || !savedState || state !== savedState || !verifier) {
    redirect('/settings?error=x-auth-failed');
  }

  let success = false;
  try {
    const tokens = await exchangeXCode(code, verifier);
    const profile = await getXProfile(tokens.access_token);
    const db = getDb();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existing = await db.select().from(xConnections).where(eq(xConnections.userId, user.id)).limit(1);
    const values = {
      xUserId: profile.id,
      userName: profile.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    };

    if (existing.length > 0) {
      await db.update(xConnections).set(values).where(eq(xConnections.userId, user.id));
    } else {
      await db.insert(xConnections).values({ userId: user.id, ...values });
    }

    await syncXForUser(user.id);
    success = true;
  } catch (err) {
    console.error('X callback error:', err);
  }

  redirect(success ? '/settings?x=connected' : '/settings?error=x-auth-failed');
}