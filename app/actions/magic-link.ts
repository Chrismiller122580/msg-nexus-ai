'use server';

import { getDb, magicLinks } from '@/db';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { getAppUrl } from '@/lib/app-url';
import { getDbErrorMessage } from '@/lib/db-error';
import { loginUser } from '@/lib/auth-user';
import { generateId } from '@/lib/utils';

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
    return { success: true, ...result };
  } catch (err: unknown) {
    console.error('verifyMagicLinkAction error:', err);
    return { error: 'Verification failed. Please request a new link.' };
  }
}