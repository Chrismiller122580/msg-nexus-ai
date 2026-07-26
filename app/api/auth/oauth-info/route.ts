import { NextResponse } from 'next/server';
import { getOAuthCallbackUrl, getRequestOrigin } from '@/lib/app-url';
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
  const origin = getRequestOrigin(request);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';

  return NextResponse.json({
    origin,
    integrations: {
      gmail: {
        configured: isGmailConfigured(),
        callbackUrl: getOAuthCallbackUrl('gmail', origin),
        env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        clientIdSuffix: clientId ? `…${clientId.slice(-24)}` : null,
      },
      outlook: {
        configured: isMicrosoftConfigured(),
        callbackUrl: getOAuthCallbackUrl('microsoft', origin),
        env: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID'],
      },
      slack: {
        configured: isSlackConfigured(),
        callbackUrl: getOAuthCallbackUrl('slack', origin),
        env: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
      },
      discord: {
        configured: isDiscordConfigured(),
        callbackUrl: getOAuthCallbackUrl('discord', origin),
        env: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
      },
      x: {
        configured: isXConfigured(),
        callbackUrl: getOAuthCallbackUrl('x', origin),
        env: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
      },
      sms: {
        configured: isTwilioConfigured(),
        webhookUrl: `${origin}/api/webhooks/twilio`,
        env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
      },
      whatsapp: {
        configured: isWhatsAppConfigured(),
        webhookUrl: `${origin}/api/webhooks/whatsapp`,
        env: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN'],
      },
      telegram: {
        configured: isTelegramConfigured(),
        webhookUrl: `${origin}/api/webhooks/telegram`,
        env: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME'],
      },
    },
  });
}