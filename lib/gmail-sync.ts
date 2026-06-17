import { getDb, gmailConnections, messages as messagesTable, connectedAccounts } from '@/db';
import { eq, and } from 'drizzle-orm';
import { fetchRecentGmailMessages, getValidAccessToken } from '@/lib/gmail';
import { parseMessage } from '@/lib/ai-parser';
import { saveInsight } from '@/app/actions/messages';

export async function ensureEmailConnectedAccount(userId: number, email: string) {
  const db = getDb();
  const [existing] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.platformId, 'email'),
        eq(connectedAccounts.identifier, email)
      )
    )
    .limit(1);

  if (existing) return;

  await db.insert(connectedAccounts).values({
    userId,
    platformId: 'email',
    identifier: email,
    label: 'Gmail',
  });
}

export async function syncGmailForUser(
  userId: number,
  limit = 25
): Promise<{ imported: number; error?: string }> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { imported: 0, error: 'Gmail is not connected.' };
  }

  const gmailMessages = await fetchRecentGmailMessages(accessToken, limit);
  const db = getDb();
  let imported = 0;

  const [conn] = await db
    .select({ email: gmailConnections.email })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);

  if (conn?.email) {
    await ensureEmailConnectedAccount(userId, conn.email);
  }

  for (const gm of gmailMessages) {
    const externalKey = `gmail-${gm.externalId}`;
    const [existing] = await db
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(and(eq(messagesTable.userId, userId), eq(messagesTable.id, externalKey)))
      .limit(1);

    if (existing) continue;

    await db.insert(messagesTable).values({
      id: externalKey,
      userId,
      platformId: 'email',
      timestamp: gm.timestamp,
      from: gm.from,
      body: gm.body,
      subject: gm.subject,
    });

    const ins = parseMessage(gm.body, gm.from);
    ins.messageId = externalKey;
    await saveInsight(ins);
    imported++;
  }

  await db
    .update(gmailConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(gmailConnections.userId, userId));

  return { imported };
}
