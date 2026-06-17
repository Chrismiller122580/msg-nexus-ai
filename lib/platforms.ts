import { Platform, PlatformId } from './types';

export const PLATFORMS: Platform[] = [
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366' },
  { id: 'email', name: 'Email', color: '#3B82F6' },
  { id: 'slack', name: 'Slack', color: '#E01E5A' },
  { id: 'sms', name: 'SMS', color: '#10B981' },
  { id: 'telegram', name: 'Telegram', color: '#229ED9' },
  { id: 'x', name: 'X / Twitter', color: '#000000' },
  { id: 'discord', name: 'Discord', color: '#5865F2' },
  { id: 'imessage', name: 'iMessage', color: '#34C759' },
];

export const PLATFORM_MAP = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
) as Record<PlatformId, Platform>;

export function getPlatform(id: PlatformId): Platform {
  return PLATFORM_MAP[id] || { id, name: id, color: '#6B7280' };
}
