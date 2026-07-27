import { NextResponse } from 'next/server';
import { getOAuthAppUrl, getOAuthCallbackUrl, getRequestOrigin } from '@/lib/app-url';
import { isDiscordConfigured } from '@/lib/discord';
import { isGmailConfigured } from '@/lib/gmail';
import { isMicrosoftConfigured } from '@/lib/microsoft';
import { isSlackConfigured } from '@/lib/slack';
import { isTelegramConfigured } from '@/lib/telegram';
import { isTwilioConfigured } from '@/lib/twilio';
import { isWhatsAppConfigured } from '@/lib/whatsapp';
import { isXConfigured } from '@/lib/x-api';

/** Public helper — shows which integrations are configured and their OAuth callbacks. */
export async function GET(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  const oauthOrigin = getOAuthAppUrl(request);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const gmailCallback = getOAuthCallbackUrl('gmail', oauthOrigin);

  return NextResponse.json({
    requestOrigin,
    oauthOrigin,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    googleCloudConsole: {
      clientType: 'Web application',
      authorizedJavaScriptOrigins: [oauthOrigin, 'https://msgnexus.ai', 'https://www.msgnexus.ai'].filter(
        (v, i, a) => a.indexOf(v) === i
      ),
      authorizedRedirectUris: [
        gmailCallback,
        'https://www.msgnexus.ai/api/auth/gmail/callback',
        'https://msgnexus.ai/api/auth/gmail/callback',
      ].filter((v, i, a) => a.indexOf(v) === i),
      note: 'Add EVERY redirect URI listed under authorizedRedirectUris to the same OAuth client as GOOGLE_CLIENT_ID on Vercel. Save and wait 1–2 minutes.',
    },
    integrations: {
      gmail: {
        configured: isGmailConfigured(),
        callbackUrl: gmailCallback,
        env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        clientIdSuffix: clientId ? `…${clientId.slice(-28)}` : null,
      },
      outlook: {
        configured: isMicrosoftConfigured(),
        callbackUrl: getOAuthCallbackUrl('microsoft', oauthOrigin),
        env: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID'],
      },
      slack: {
        configured: isSlackConfigured(),
        callbackUrl: getOAuthCallbackUrl('slack', oauthOrigin),
        env: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
      },
      discord: {
        configured: isDiscordConfigured(),
        callbackUrl: getOAuthCallbackUrl('discord', oauthOrigin),
        env: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
      },
      x: {
        configured: isXConfigured(),
        callbackUrl: getOAuthCallbackUrl('x', oauthOrigin),
        env: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
      },
      sms: {
        configured: isTwilioConfigured(),
        webhookUrl: `${oauthOrigin}/api/webhooks/twilio`,
        env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
      },
      whatsapp: {
        configured: isWhatsAppConfigured(),
        webhookUrl: `${oauthOrigin}/api/webhooks/whatsapp`,
        env: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN'],
      },
      telegram: {
        configured: isTelegramConfigured(),
        webhookUrl: `${oauthOrigin}/api/webhooks/telegram`,
        env: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME'],
      },
    },
  });
}