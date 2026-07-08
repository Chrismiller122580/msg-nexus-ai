import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, outlookConnections } from '@/db';
import { getCurrentUser } from '@/lib/session';
import { exchangeMicrosoftCode, getMicrosoftProfile } from '@/lib/microsoft';
import { syncOutlookForUser } from '@/lib/microsoft-sync';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/settings');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const savedState = cookieStore.get('microsoft-oauth-state')?.value;
  const oauthOrigin = cookieStore.get('microsoft-oauth-origin')?.value;

  cookieStore.delete('microsoft-oauth-state');
  cookieStore.delete('microsoft-oauth-origin');

  if (!code || !state || !savedState || state !== savedState) {
    redirect('/settings?error=outlook-auth-failed');
  }

  let success = false;
  try {
    const tokens = await exchangeMicrosoftCode(code, oauthOrigin);
    const profile = await getMicrosoftProfile(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const db = getDb();

    const existing = await db
      .select()
      .from(outlookConnections)
      .where(eq(outlookConnections.userId, user.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(outlookConnections)
        .set({
          email: profile.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? existing[0].refreshToken,
          expiresAt,
        })
        .where(eq(outlookConnections.userId, user.id));
    } else {
      await db.insert(outlookConnections).values({
        userId: user.id,
        email: profile.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
    }

    await syncOutlookForUser(user.id);
    success = true;
  } catch (err) {
    console.error('Microsoft callback error:', err);
  }

  redirect(success ? '/settings?outlook=connected' : '/settings?error=outlook-auth-failed');
}