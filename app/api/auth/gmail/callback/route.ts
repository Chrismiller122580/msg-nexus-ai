import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, gmailConnections } from '@/db';
import { getCurrentUser } from '@/lib/session';
import { exchangeGmailCode, getGmailProfile } from '@/lib/gmail';
import { ensureEmailConnectedAccount, syncGmailForUser } from '@/lib/gmail-sync';
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
  const savedState = cookieStore.get('gmail-oauth-state')?.value;

  cookieStore.delete('gmail-oauth-state');

  if (!code || !state || !savedState || state !== savedState) {
    redirect('/settings?error=gmail-auth-failed');
  }

  let success = false;
  try {
    const tokens = await exchangeGmailCode(code);
    const profile = await getGmailProfile(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const db = getDb();

    const existing = await db
      .select()
      .from(gmailConnections)
      .where(eq(gmailConnections.userId, user.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(gmailConnections)
        .set({
          email: profile.emailAddress,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? existing[0].refreshToken,
          expiresAt,
        })
        .where(eq(gmailConnections.userId, user.id));
    } else {
      await db.insert(gmailConnections).values({
        userId: user.id,
        email: profile.emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
    }

    await ensureEmailConnectedAccount(user.id, profile.emailAddress);
    await syncGmailForUser(user.id);
    success = true;
  } catch (err) {
    console.error('Gmail callback error:', err);
  }

  redirect(success ? '/inbox?gmail=synced' : '/settings?error=gmail-auth-failed');
}
