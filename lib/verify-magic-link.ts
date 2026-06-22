import { getDb, magicLinks } from '@/db';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { loginUser } from '@/lib/auth-user';
import { getDbErrorMessage } from '@/lib/db-error';

export type VerifyMagicLinkResult = {
  success?: boolean;
  error?: string;
  onboarded?: boolean;
};

export async function verifyMagicLinkToken(token: string): Promise<VerifyMagicLinkResult> {
  if (!token) {
    return { error: 'Invalid link' };
  }

  try {
    const db = getDb();
    const now = new Date();

    const [link] = await db
      .select()
      .from(magicLinks)
      .where(
        and(
          eq(magicLinks.token, token),
          gt(magicLinks.expiresAt, now),
          isNull(magicLinks.usedAt)
        )
      )
      .limit(1);

    if (!link) {
      return { error: 'This link is invalid or has expired.' };
    }

    await db
      .update(magicLinks)
      .set({ usedAt: now })
      .where(eq(magicLinks.id, link.id));

    const result = await loginUser(link.email);
    return { success: true, onboarded: result.onboarded };
  } catch (err: unknown) {
    console.error('verifyMagicLinkToken error:', err);
    const dbError = getDbErrorMessage(err);
    if (dbError) return { error: dbError };
    return { error: 'Verification failed. Please request a new link.' };
  }
}