import { NextResponse } from 'next/server';
import { getDb, gmailConnections, outlookConnections, twilioConnections } from '@/db';
import { syncAllConnectors } from '@/lib/connectors/sync-all';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const userIds = new Set<number>();

  const [gmail, outlook, twilio] = await Promise.all([
    db.select({ userId: gmailConnections.userId }).from(gmailConnections),
    db.select({ userId: outlookConnections.userId }).from(outlookConnections),
    db.select({ userId: twilioConnections.userId }).from(twilioConnections),
  ]);

  for (const row of [...gmail, ...outlook, ...twilio]) {
    userIds.add(row.userId);
  }

  let totalImported = 0;
  const results: Array<{ userId: number; imported: number }> = [];

  for (const userId of userIds) {
    const sync = await syncAllConnectors(userId);
    totalImported += sync.totalImported;
    results.push({ userId, imported: sync.totalImported });
  }

  return NextResponse.json({
    ok: true,
    usersSynced: userIds.size,
    totalImported,
    results,
  });
}