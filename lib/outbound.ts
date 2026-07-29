/** Outbound send capabilities and helpers for compose. */

import type { PlatformId } from '@/lib/types';

export type OutboundPlatform = Extract<PlatformId, 'sms' | 'whatsapp' | 'telegram' | 'email' | 'slack'>;

export type SendCapability = {
  platform: PlatformId;
  canSend: boolean;
  label: string;
  reason?: string;
};

/** Honest v1 matrix — email/slack need scope upgrades later. */
export function getSendCapabilities(connected: PlatformId[]): SendCapability[] {
  const set = new Set(connected);
  const all: SendCapability[] = [
    {
      platform: 'sms',
      canSend: set.has('sms'),
      label: 'SMS',
      reason: set.has('sms') ? undefined : 'Connect Twilio SMS in Settings',
    },
    {
      platform: 'whatsapp',
      canSend: set.has('whatsapp'),
      label: 'WhatsApp',
      reason: set.has('whatsapp') ? undefined : 'Connect WhatsApp in Settings',
    },
    {
      platform: 'telegram',
      canSend: set.has('telegram'),
      label: 'Telegram',
      reason: set.has('telegram') ? undefined : 'Link Telegram in Settings',
    },
    {
      platform: 'email',
      canSend: false,
      label: 'Email',
      reason: 'Read-only for now (Gmail/Outlook need send scopes)',
    },
    {
      platform: 'slack',
      canSend: false,
      label: 'Slack',
      reason: 'Read-only for now (needs chat:write)',
    },
  ];
  return all;
}

export function canSendPlatform(platform: PlatformId): boolean {
  return platform === 'sms' || platform === 'whatsapp' || platform === 'telegram';
}
