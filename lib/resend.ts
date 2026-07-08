import { Resend } from 'resend';
import { WelcomeEmail } from '@/lib/emails/welcome-email';
import { getAppUrl } from '@/lib/app-url';
import { buildMagicLinkHtml } from '@/lib/magic-link-html';
import { getResendUserMessage, parseResendError } from '@/lib/resend-errors';

const RESEND_DEV_FROM = 'MsgNexus.AI <onboarding@resend.dev>';

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

/** Resend requires a verified domain in production — never silently use resend.dev there. */
export function getFromAddress(): string | null {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return null;
  }

  return RESEND_DEV_FROM;
}

export function getResendConfigError(): string | null {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return 'Email sign-in is not configured. RESEND_API_KEY is missing.';
  }

  const from = getFromAddress();
  if (!from) {
    return 'Email sign-in is not configured. Set RESEND_FROM_EMAIL to a verified address on msgnexus.ai in Vercel.';
  }

  return null;
}

export async function sendMagicLinkEmail(
  email: string,
  signInUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const configError = getResendConfigError();
  if (configError) {
    return { ok: false, error: configError };
  }

  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: 'Email sign-in is not configured. RESEND_API_KEY is missing.' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromAddress()!,
      to: email,
      subject: 'Sign in to MsgNexus.AI',
      html: buildMagicLinkHtml(signInUrl),
    });

    if (error) {
      console.error('Resend magic link error:', error);
      return { ok: false, error: parseResendError(error) };
    }

    if (!data?.id) {
      return { ok: false, error: 'Failed to send sign-in email. Please try again.' };
    }

    return { ok: true };
  } catch (err) {
    console.error('sendMagicLinkEmail error:', err);
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: getResendUserMessage(raw, 500) };
  }
}

export async function sendWelcomeEmail(user: {
  email: string;
  name?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  const from = getFromAddress();
  if (!from) {
    return { ok: false, error: 'RESEND_FROM_EMAIL not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: user.email,
      subject: 'Welcome to MsgNexus!',
      react: WelcomeEmail({ name: user.name, appUrl: getAppUrl() }),
    });

    if (error) {
      console.error('Resend welcome email error:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error('sendWelcomeEmail error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
  }
}