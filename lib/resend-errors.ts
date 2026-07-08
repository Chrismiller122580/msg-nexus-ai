/** Map Resend API errors to user-safe messages (no secrets). */
export function getResendUserMessage(raw: string, status: number): string {
  const lower = raw.toLowerCase();

  if (
    status === 403 &&
    (lower.includes('resend.dev') ||
      lower.includes('testing emails') ||
      lower.includes('your own email'))
  ) {
    return 'Sign-in email is not configured for production yet. The site owner must verify msgnexus.ai in Resend and set RESEND_FROM_EMAIL on Vercel.';
  }

  if (lower.includes('domain') && (lower.includes('verify') || lower.includes('verified'))) {
    return 'The sender domain is not verified in Resend. Verify your domain and set RESEND_FROM_EMAIL to an address on that domain.';
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