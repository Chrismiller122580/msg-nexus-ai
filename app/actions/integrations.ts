'use server';

import { requireUser } from '@/lib/session';
import { syncAllConnectors } from '@/lib/connectors/sync-all';
import { revalidatePath } from 'next/cache';

export async function syncAllIntegrationsAction(): Promise<{
  success?: boolean;
  error?: string;
  totalImported?: number;
  details?: Record<string, { imported: number; error?: string; info?: string }>;
}> {
  try {
    const user = await requireUser();
    const result = await syncAllConnectors(user.id);

    revalidatePath('/inbox');
    revalidatePath('/settings');

    return {
      success: true,
      totalImported: result.totalImported,
      details: {
        gmail: result.gmail,
        outlook: result.outlook,
        twilio: result.twilio,
        slack: result.slack,
        discord: result.discord,
        telegram: result.telegram,
        whatsapp: result.whatsapp,
        x: result.x,
      },
    };
  } catch (err: unknown) {
    console.error('syncAllIntegrationsAction error:', err);
    return { error: err instanceof Error ? err.message : 'Sync failed' };
  }
}