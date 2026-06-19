import { getDb, messages as messagesTable, connectedAccounts } from '@/db';
import { eq, and } from 'drizzle-orm';
import { parseMessage } from '@/lib/ai-parser';
import { saveInsight } from '@/app/actions/messages';
import type { PlatformId } from '@/lib/types';
import type { FetchedMessage } from './types';

export async function ensureConnectedAccount(
  userId: number,
  platformId: PlatformId,
  identifier: string,
  label?: string
) {
  const db = getDb();
  const [existing] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.platformId, platformId),
        eq(connectedAccounts.identifier, identifier)
      )
    )
    .limit(1);

  if (existing) return;

  await db.insert(connectedAccounts).values({
    userId,
    platformId,
    identifier,
    label: label || null,
  });
}

export async function ingestMessages(
  userId: number,
  items: FetchedMessage[],
  idPrefix: string
): Promise<number> {
  const db = getDb();
  let imported = 0;

  for (const item of items) {
    const messageId = `${idPrefix}-${item.externalId}`;
    const [existing] = await db
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(and(eq(messagesTable.userId, userId), eq(messagesTable.id, messageId)))
      .limit(1);

    if (existing) continue;

    await db.insert(messagesTable).values({
      id: messageId,
      userId,
      platformId: item.platformId,
      timestamp: item.timestamp,
      from: item.from,
      body: item.body,
      subject: item.subject,
    });

    const ins = parseMessage(item.body, item.from);
    ins.messageId = messageId;
    await saveInsight(ins);
    imported++;
  }

  return imported;
}