'use server';

import { requireUser } from '@/lib/session';
import { syncAllConnectors } from '@/lib/connectors/sync-all';
import { revalidatePath } from 'next/cache';

export async function syncAllIntegrationsAction(): Promise<{
  success?: boolean;
  error?: string;
  totalImported?: number;
  details?: {
    gmail: { imported: number; error?: string };
    outlook: { imported: number; error?: string };
    twilio: { imported: number; error?: string };
  };
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
      },
    };
  } catch (err: unknown) {
    console.error('syncAllIntegrationsAction error:', err);
    return { error: err instanceof Error ? err.message : 'Sync failed' };
  }
}