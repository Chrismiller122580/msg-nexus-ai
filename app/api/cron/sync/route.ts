import { NextResponse } from 'next/server';
import {
  getDb,
  gmailConnections,
  outlookConnections,
  twilioConnections,
  slackConnections,
  whatsappConnections,
  xConnections,
} from '@/db';
import { syncAllConnectors } from '@/lib/connectors/sync-all';
import { recordSyncRun } from '@/lib/sync-health';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const userIds = new Set<number>();

  const tables = await Promise.all([
    db.select({ userId: gmailConnections.userId }).from(gmailConnections),
    db.select({ userId: outlookConnections.userId }).from(outlookConnections),
    db.select({ userId: twilioConnections.userId }).from(twilioConnections),
    db.select({ userId: slackConnections.userId }).from(slackConnections),
    db.select({ userId: whatsappConnections.userId }).from(whatsappConnections),
    db.select({ userId: xConnections.userId }).from(xConnections),
  ]);

  for (const rows of tables) {
    for (const row of rows) userIds.add(row.userId);
  }

  let totalImported = 0;
  const results: Array<{ userId: number; imported: number; error?: string }> = [];

  for (const userId of userIds) {
    try {
      const sync = await syncAllConnectors(userId);
      await recordSyncRun({ userId, source: 'cron', result: sync });
      totalImported += sync.totalImported;
      results.push({ userId, imported: sync.totalImported });
    } catch (err) {
      results.push({
        userId,
        imported: 0,
        error: err instanceof Error ? err.message : 'sync failed',
      });
    }
  }

  return NextResponse.json({ ok: true, usersSynced: userIds.size, totalImported, results });
}
