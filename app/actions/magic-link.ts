'use server';

import { getDb, magicLinks } from '@/db';
import { getAppUrl } from '@/lib/app-url';
import { getDbErrorMessage } from '@/lib/db-error';
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

    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'MsgNexus.AI <onboarding@resend.dev>',
          to: normalizedEmail,
          subject: 'Sign in to MsgNexus.AI',
          html: `<p>Click to sign in (expires in 15 minutes):</p><p><a href="${link}">${link}</a></p>`,
        }),
      });

      if (!res.ok) {
        console.error('Resend error:', await res.text());
        return { error: 'Failed to send email. Try demo login instead.' };
      }

      return { success: true };
    }

    if (process.env.NODE_ENV === 'development') {
      return { success: true, devLink: link };
    }

    return {
      error: 'Email sending is not configured. Set RESEND_API_KEY or use demo login.',
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