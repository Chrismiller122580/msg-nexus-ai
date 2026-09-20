import { getDb, syncRuns } from '@/db';
import { desc, eq } from 'drizzle-orm';
import type { AllSyncResult } from '@/lib/connectors/sync-all';

export async function recordSyncRun(opts: {
  userId: number;
  source: 'cron' | 'manual' | 'gmail-push';
  result: AllSyncResult;
}) {
  const errors = [
    opts.result.gmail.error,
    opts.result.outlook.error,
    opts.result.twilio.error,
    opts.result.slack.error,
    opts.result.whatsapp.error,
    opts.result.x.error,
  ].filter((e): e is string => Boolean(e && !/not connected/i.test(e)));

  const db = getDb();
  await db.insert(syncRuns).values({
    userId: opts.userId,
    source: opts.source,
    imported: opts.result.totalImported,
    errors: errors.length ? errors.join(' · ') : null,
    details: {
      gmail: opts.result.gmail,
      outlook: opts.result.outlook,
      twilio: opts.result.twilio,
      slack: opts.result.slack,
      whatsapp: opts.result.whatsapp,
      x: opts.result.x,
    },
  });

  return { errors };
}

export async function getLatestSyncRun(userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.userId, userId))
    .orderBy(desc(syncRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
