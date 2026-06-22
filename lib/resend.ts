import { Resend } from 'resend';
import { WelcomeEmail } from '@/lib/emails/welcome-email';
import { getAppUrl } from '@/lib/app-url';

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || 'MsgNexus.AI <onboarding@resend.dev>';
}

export async function sendWelcomeEmail(user: {
  email: string;
  name?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
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