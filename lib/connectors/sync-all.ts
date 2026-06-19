import { syncGmailForUser } from '@/lib/gmail-sync';
import { syncOutlookForUser } from '@/lib/microsoft-sync';
import { syncTwilioForUser } from '@/lib/twilio-sync';
import type { SyncResult } from './types';

export interface AllSyncResult {
  gmail: SyncResult;
  outlook: SyncResult;
  twilio: SyncResult;
  totalImported: number;
}

export async function syncAllConnectors(userId: number): Promise<AllSyncResult> {
  const [gmail, outlook, twilio] = await Promise.all([
    syncGmailForUser(userId),
    syncOutlookForUser(userId),
    syncTwilioForUser(userId),
  ]);

  return {
    gmail,
    outlook,
    twilio,
    totalImported: gmail.imported + outlook.imported + twilio.imported,
  };
}