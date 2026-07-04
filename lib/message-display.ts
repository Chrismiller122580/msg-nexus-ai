import { getPlatform } from '@/lib/platforms';
import type { Message, PlatformId } from '@/lib/types';

const SOURCE_BADGES: Record<string, { name: string; color: string }> = {
  gmail: { name: 'Gmail', color: '#EA4335' },
  outlook: { name: 'Outlook', color: '#0078D4' },
  twilio: { name: 'SMS', color: '#10B981' },
  slack: { name: 'Slack', color: '#E01E5A' },
  discord: { name: 'Discord', color: '#5865F2' },
  telegram: { name: 'Telegram', color: '#229ED9' },
  whatsapp: { name: 'WhatsApp', color: '#25D366' },
  x: { name: 'X', color: '#000000' },
};

/** Resolve inbox badge from ingest id prefix (e.g. gmail-abc) or platformId fallback */
export function getMessageBadge(message: Message): { name: string; color: string; platformId: PlatformId } {
  const prefix = message.id.split('-')[0];
  const source = SOURCE_BADGES[prefix];
  if (source) {
    return { ...source, platformId: message.platformId };
  }
  const plat = getPlatform(message.platformId);
  return { name: plat.name, color: plat.color, platformId: message.platformId };
}