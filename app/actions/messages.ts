'use server';

import { getDb, messages as messagesTable, insights as insightsTable } from '@/db';
import { requireUser } from '@/lib/session';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { Message, Insight, Category } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { dispatchWebhookEvent } from '@/lib/webhooks';

type DbInsightRow = typeof insightsTable.$inferSelect;

function mapInsightRow(ins: DbInsightRow): Insight {
  return {
    messageId: ins.messageId,
    category: ins.category as Category,
    amount: ins.amount ? Number(ins.amount) : undefined,
    currency: ins.currency || 'USD',
    vendor: ins.vendor || undefined,
    dueDate: ins.dueDate || undefined,
    isRecurring: ins.isRecurring ?? undefined,
    confidence: ins.confidence ? Number(ins.confidence) : 0.5,
    summary: ins.summary || '',
    entities: Array.isArray(ins.entities)
      ? (ins.entities as Insight['entities'])
      : [],
  };
}

export async function getUserMessages(): Promise<{ messages: Message[]; insights: Record<string, Insight> }> {
  const db = getDb();
  const user = await requireUser();

  const userMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.userId, user.id))
    .orderBy(desc(messagesTable.timestamp));

  const messageIds = userMessages.map((m: { id: string }) => m.id);

  let userInsights: DbInsightRow[] = [];
  if (messageIds.length > 0) {
    userInsights = await db
      .select()
      .from(insightsTable)
      .where(inArray(insightsTable.messageId, messageIds));
  }

  const insightsMap: Record<string, Insight> = {};
  for (const ins of userInsights) {
    insightsMap[ins.messageId] = mapInsightRow(ins);
  }

  return {
    messages: userMessages as unknown as Message[],
    insights: insightsMap,
  };
}

export async function saveMessage(message: Omit<Message, 'id'> & { id?: string }) {
  const db = getDb();
  const user = await requireUser();

  const id = message.id || generateId();

  await db.insert(messagesTable).values({
    id,
    userId: user.id,
    platformId: message.platformId,
    timestamp: message.timestamp,
    from: message.from,
    body: message.body,
    subject: message.subject,
  });

  void dispatchWebhookEvent('message.created', {
    userId: user.id,
    messageId: id,
    platformId: message.platformId,
    from: message.from,
  });

  revalidatePath('/inbox');
  return { id };
}

export async function saveInsight(insight: Insight) {
  const db = getDb();

  await db.delete(insightsTable).where(eq(insightsTable.messageId, insight.messageId));

  await db.insert(insightsTable).values({
    messageId: insight.messageId,
    category: insight.category,
    amount: insight.amount?.toString(),
    currency: insight.currency,
    vendor: insight.vendor,
    dueDate: insight.dueDate,
    isRecurring: insight.isRecurring,
    confidence: insight.confidence?.toString(),
    summary: insight.summary,
    entities: insight.entities,
  });

  revalidatePath('/inbox');
}

export async function deleteUserMessage(messageId: string) {
  const db = getDb();
  const user = await requireUser();

  await db
    .delete(messagesTable)
    .where(and(eq(messagesTable.id, messageId), eq(messagesTable.userId, user.id)));

  await db.delete(insightsTable).where(eq(insightsTable.messageId, messageId));

  revalidatePath('/inbox');
}

export async function resetUserData() {
  const db = getDb();
  const user = await requireUser();

  await db.delete(messagesTable).where(eq(messagesTable.userId, user.id));

  revalidatePath('/inbox');
}

const VALID_CATEGORIES = new Set<Category>(['bill', 'subscription', 'shopping', 'other']);
const VALID_PLATFORMS = new Set([
  'whatsapp', 'email', 'slack', 'sms', 'telegram', 'x', 'discord', 'imessage',
]);

export async function importUserMessages(payload: {
  messages: Message[];
  insights?: Record<string, Insight>;
}): Promise<{ imported: number; skipped: number; error?: string }> {
  try {
    const db = getDb();
    const user = await requireUser();

    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return { imported: 0, skipped: 0, error: 'No messages to import' };
    }

    let imported = 0;
    let skipped = 0;

    for (const raw of payload.messages) {
      if (!raw?.body || !raw?.from || !raw?.platformId || !raw?.timestamp) {
        skipped++;
        continue;
      }
      if (!VALID_PLATFORMS.has(raw.platformId)) {
        skipped++;
        continue;
      }

      const id = raw.id || generateId();
      const [existing] = await db
        .select({ id: messagesTable.id })
        .from(messagesTable)
        .where(and(eq(messagesTable.id, id), eq(messagesTable.userId, user.id)))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(messagesTable).values({
        id,
        userId: user.id,
        platformId: raw.platformId,
        timestamp: raw.timestamp,
        from: raw.from,
        body: raw.body,
        subject: raw.subject,
      });

      const insight = payload.insights?.[id] ?? payload.insights?.[raw.id];
      if (insight && VALID_CATEGORIES.has(insight.category)) {
        await db.delete(insightsTable).where(eq(insightsTable.messageId, id));
        await db.insert(insightsTable).values({
          messageId: id,
          category: insight.category,
          amount: insight.amount?.toString(),
          currency: insight.currency,
          vendor: insight.vendor,
          dueDate: insight.dueDate,
          isRecurring: insight.isRecurring,
          confidence: insight.confidence?.toString(),
          summary: insight.summary,
          entities: insight.entities,
        });
      }

      imported++;
    }

    revalidatePath('/inbox');
    return { imported, skipped };
  } catch (err: unknown) {
    console.error('importUserMessages error:', err);
    return {
      imported: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : 'Import failed',
    };
  }
}