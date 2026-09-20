import { NextResponse } from 'next/server';
import { getDb, gmailConnections } from '@/db';
import { syncGmailForUser } from '@/lib/gmail-sync';
import { eq } from 'drizzle-orm';

/**
 * Gmail push or manual trigger.
 * Authorize with Bearer CRON_SECRET, or a Pub/Sub body { emailAddress, historyId }.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let email: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.message?.data) {
      const decoded = JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8'));
      email = decoded.emailAddress;
    } else {
      email = body.emailAddress || body.email;
    }
  } catch {
    /* empty body is fine — sync all Gmail users */
  }

  const db = getDb();
  const rows = email
    ? await db.select({ userId: gmailConnections.userId }).from(gmailConnections).where(eq(gmailConnections.email, email))
    : await db.select({ userId: gmailConnections.userId }).from(gmailConnections);

  const userIds: number[] = [
    ...new Set(
      (rows as Array<{ userId: number }>)
        .map((r) => Number(r.userId))
        .filter((id) => Number.isFinite(id))
    ),
  ];
  let imported = 0;
  for (const userId of userIds) {
    const r = await syncGmailForUser(userId);
    imported += r.imported;
  }

  return NextResponse.json({ ok: true, users: userIds.length, imported });
}
