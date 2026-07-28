import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, outlookConnections } from '@/db';
import { getCurrentUser } from '@/lib/session';
import { exchangeMicrosoftCode, getMicrosoftProfile } from '@/lib/microsoft';
import { ensureOutlookConnectedAccount, syncOutlookForUser } from '@/lib/microsoft-sync';
import { and, eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?redirect=/settings');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const oauthErrorDesc = url.searchParams.get('error_description');
  const cookieStore = await cookies();
  const savedState = cookieStore.get('microsoft-oauth-state')?.value;
  const oauthOrigin = cookieStore.get('microsoft-oauth-origin')?.value;

  cookieStore.delete('microsoft-oauth-state');
  cookieStore.delete('microsoft-oauth-origin');

  if (oauthError) {
    const detail = (oauthErrorDesc || oauthError).slice(0, 180);
    redirect(
      `/settings?error=outlook-auth-failed&detail=${encodeURIComponent(detail)}`
    );
  }

  if (!code || !state || !savedState || state !== savedState) {
    redirect('/settings?error=outlook-auth-failed&detail=state_mismatch');
  }

  let success = false;
  let syncError: string | undefined;
  let imported = 0;

  try {
    const tokens = await exchangeMicrosoftCode(code, oauthOrigin);
    const profile = await getMicrosoftProfile(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const db = getDb();
    const email = profile.email;

    const existing = await db
      .select()
      .from(outlookConnections)
      .where(and(eq(outlookConnections.userId, user.id), eq(outlookConnections.email, email)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(outlookConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? existing[0].refreshToken,
          expiresAt,
        })
        .where(eq(outlookConnections.id, existing[0].id));
    } else {
      await db.insert(outlookConnections).values({
        userId: user.id,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
    }

    await ensureOutlookConnectedAccount(user.id, email);
    const sync = await syncOutlookForUser(user.id);
    success = true;
    imported = sync.imported ?? 0;
    if (sync.error) {
      console.error('Outlook initial sync error:', sync.error);
      syncError = sync.error;
    }
  } catch (err) {
    console.error('Microsoft callback error:', err);
    const msg = err instanceof Error ? err.message : 'Outlook authorization failed';
    redirect(
      `/settings?error=outlook-auth-failed&detail=${encodeURIComponent(msg.slice(0, 180))}`
    );
  }

  if (!success) {
    redirect('/settings?error=outlook-auth-failed');
  }
  if (syncError) {
    redirect(
      `/settings?outlook=connected&error=outlook-sync-failed&detail=${encodeURIComponent(syncError.slice(0, 180))}`
    );
  }
  if (imported > 0) {
    redirect(`/settings?outlook=connected&imported=${imported}`);
  }
  redirect('/settings?outlook=connected');
}
