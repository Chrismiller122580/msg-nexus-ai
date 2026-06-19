import { syncGmailForUser } from '@/lib/gmail-sync';
import { syncOutlookForUser } from '@/lib/microsoft-sync';
import { syncTwilioForUser } from '@/lib/twilio-sync';
import { syncSlackForUser } from '@/lib/slack-sync';
import { syncDiscordForUser } from '@/lib/discord-sync';
import { syncTelegramForUser } from '@/lib/telegram-sync';
import { syncWhatsAppForUser } from '@/lib/whatsapp-sync';
import { syncXForUser } from '@/lib/x-sync';
import type { SyncResult } from './types';

export interface AllSyncResult {
  gmail: SyncResult;
  outlook: SyncResult;
  twilio: SyncResult;
  slack: SyncResult;
  discord: SyncResult;
  telegram: SyncResult;
  whatsapp: SyncResult;
  x: SyncResult;
  totalImported: number;
}

export async function syncAllConnectors(userId: number): Promise<AllSyncResult> {
  const [gmail, outlook, twilio, slack, discord, telegram, whatsapp, x] = await Promise.all([
    syncGmailForUser(userId),
    syncOutlookForUser(userId),
    syncTwilioForUser(userId),
    syncSlackForUser(userId),
    syncDiscordForUser(userId),
    syncTelegramForUser(userId),
    syncWhatsAppForUser(userId),
    syncXForUser(userId),
  ]);

  const totalImported =
    gmail.imported + outlook.imported + twilio.imported +
    slack.imported + discord.imported + telegram.imported +
    whatsapp.imported + x.imported;

  return { gmail, outlook, twilio, slack, discord, telegram, whatsapp, x, totalImported };
}