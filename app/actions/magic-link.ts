'use server';

import { getDb, magicLinks } from '@/db';
import { getAppUrl } from '@/lib/app-url';
import { getDbErrorMessage } from '@/lib/db-error';
import { isDevMagicLinkAllowed } from '@/lib/env';
import { sendMagicLinkEmail } from '@/lib/resend';
import { generateId } from '@/lib/utils';
import { verifyMagicLinkToken } from '@/lib/verify-magic-link';

export async function requestMagicLinkAction(email: string): Promise<{
  success?: boolean;
  error?: string;
  devLink?: string;
}> {
  try {
    if (!email?.includes('@')) {
      return { error: 'Please enter a valid email' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const token = generateId() + generateId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const db = getDb();
    await db.insert(magicLinks).values({
      email: normalizedEmail,
      token,
      expiresAt,
    });

    const link = `${getAppUrl()}/auth/verify?token=${token}`;

    if (process.env.RESEND_API_KEY?.trim()) {
      const sent = await sendMagicLinkEmail(normalizedEmail, link);
      if (!sent.ok) {
        return { error: sent.error || 'Failed to send sign-in email. Please try again.' };
      }
      return { success: true };
    }

    if (isDevMagicLinkAllowed()) {
      return { success: true, devLink: link };
    }

    return {
      error: 'Email sign-in is not configured. Contact support or try again later.',
    };
  } catch (err: unknown) {
    console.error('requestMagicLinkAction error:', err);
    const dbError = getDbErrorMessage(err);
    if (dbError) return { error: dbError };
    return { error: 'Could not send magic link. Please try again.' };
  }
}

export async function verifyMagicLinkAction(token: string) {
  return verifyMagicLinkToken(token);
}