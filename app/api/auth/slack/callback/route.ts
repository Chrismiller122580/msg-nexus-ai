import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, slackConnections } from '@/db';
import { getCurrentUser } from '@/lib/session';
import { exchangeSlackCode, getSlackUser } from '@/lib/slack';
import { syncSlackForUser } from '@/lib/slack-sync';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const savedState = cookieStore.get('slack-oauth-state')?.value;
  cookieStore.delete('slack-oauth-state');

  if (!code || !state || !savedState || state !== savedState) {
    redirect('/settings?error=slack-auth-failed');
  }

  let success = false;
  try {
    const data = await exchangeSlackCode(code);
    const userName = await getSlackUser(data.access_token!);
    const db = getDb();
    const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

    const existing = await db.select().from(slackConnections).where(eq(slackConnections.userId, user.id)).limit(1);
    const values = {
      teamId: data.team?.id,
      teamName: data.team?.name,
      userName,
      accessToken: data.access_token!,
      refreshToken: data.refresh_token,
      expiresAt,
    };

    if (existing.length > 0) {
      await db.update(slackConnections).set(values).where(eq(slackConnections.userId, user.id));
    } else {
      await db.insert(slackConnections).values({ userId: user.id, ...values });
    }

    await syncSlackForUser(user.id);
    success = true;
  } catch (err) {
    console.error('Slack callback error:', err);
  }

  redirect(success ? '/settings?slack=connected' : '/settings?error=slack-auth-failed');
}