'use server';

import { getDb, messages as messagesTable } from '@/db';
import { requireUser } from '@/lib/session';
import { eq, and, isNull, or } from 'drizzle-orm';
import { contentFingerprint, threadKey } from '@/lib/message-dedupe';
import { revalidatePath } from 'next/cache';

/** Fill fingerprint + threadKey on older rows so inbox grouping works. */
export async function backfillMessageThreadsAction(): Promise<{
  updated: number;
  error?: string;
}> {
  try {
    const db = getDb();
    const user = await requireUser();

    const rows = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.userId, user.id),
          or(isNull(messagesTable.fingerprint), isNull(messagesTable.threadKey))
        )
      );

    let updated = 0;
    for (const row of rows) {
      const fingerprint = contentFingerprint({
        from: row.from,
        body: row.body,
        subject: row.subject,
      });
      const thread = threadKey({
        from: row.from,
        body: row.body,
        subject: row.subject,
      });
      await db
        .update(messagesTable)
        .set({ fingerprint, threadKey: thread })
        .where(and(eq(messagesTable.id, row.id), eq(messagesTable.userId, user.id)));
      updated++;
    }

    if (updated > 0) {
      revalidatePath('/inbox');
      revalidatePath('/dashboard');
    }
    return { updated };
  } catch (err: unknown) {
    console.error('backfillMessageThreadsAction', err);
    return {
      updated: 0,
      error: err instanceof Error ? err.message : 'Backfill failed',
    };
  }
}
