type ResendErrorLike = {
  message?: string;
  statusCode?: number | null;
  name?: string;
};

/** Map Resend API errors to user-safe messages (no secrets). */
export function getResendUserMessage(raw: string, status = 500): string {
  const lower = raw.toLowerCase();

  if (
    lower.includes('failed to render react') ||
    lower.includes('@react-email/render')
  ) {
    return 'Email template failed to render. The site owner should redeploy after installing @react-email/render.';
  }

  if (
    status === 403 &&
    (lower.includes('resend.dev') ||
      lower.includes('testing emails') ||
      lower.includes('your own email'))
  ) {
    return 'Sign-in email is not configured for production yet. Verify msgnexus.ai in Resend and set RESEND_FROM_EMAIL on Vercel.';
  }

  if (
    lower.includes('not verified') ||
    (lower.includes('domain') && (lower.includes('verify') || lower.includes('verified')))
  ) {
    return 'The sender domain msgnexus.ai is not verified in Resend. Add DNS records at resend.com/domains, then set RESEND_FROM_EMAIL to MsgNexus.AI <onboarding@msgnexus.ai> on Vercel.';
  }

  if (lower.includes('from') && (lower.includes('invalid') || lower.includes('required'))) {
    return 'Email sender is misconfigured. Set RESEND_FROM_EMAIL to a verified address (e.g. MsgNexus.AI <onboarding@msgnexus.ai>).';
  }

  if (status === 401 || lower.includes('api key') || lower.includes('unauthorized')) {
    return 'Email service authentication failed. Check RESEND_API_KEY on Vercel.';
  }

  if (status === 429 || lower.includes('rate limit')) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  }

  return 'Failed to send sign-in email. Please try again in a few minutes.';
}

export function parseResendError(error: ResendErrorLike | null | undefined): string {
  if (!error) {
    return 'Failed to send sign-in email. Please try again in a few minutes.';
  }

  const status = error.statusCode ?? 422;
  const raw = [error.message, error.name].filter(Boolean).join(' ');
  return getResendUserMessage(raw || JSON.stringify(error), status);
}