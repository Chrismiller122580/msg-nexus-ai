import { NextResponse } from 'next/server';
import { getOAuthCallbackUrl, getRequestOrigin } from '@/lib/app-url';
import { isGmailConfigured } from '@/lib/gmail';
import { isGoogleOAuthConfigured } from '@/lib/google-oauth';

/** Public helper — shows exact OAuth callback URLs for the current host. */
export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';

  return NextResponse.json({
    origin,
    gmail: {
      configured: isGmailConfigured(),
      callbackUrl: getOAuthCallbackUrl('gmail', origin),
      clientIdSuffix: clientId ? `…${clientId.slice(-20)}` : null,
    },
    outlook: { callbackUrl: getOAuthCallbackUrl('microsoft', origin) },
    slack: { callbackUrl: getOAuthCallbackUrl('slack', origin) },
    discord: { callbackUrl: getOAuthCallbackUrl('discord', origin) },
    x: { callbackUrl: getOAuthCallbackUrl('x', origin) },
    googleSecretConfigured: isGoogleOAuthConfigured(),
  });
}