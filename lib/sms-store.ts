import { getDb, smsMessages } from '@/db';
import { desc, eq } from 'drizzle-orm';
import { generateId } from '@/lib/utils';

export type SmsDirection = 'in' | 'out';
export type SmsStatus = 'received' | 'sent' | 'queued' | 'failed';

export type SaveSmsInput = {
  userId: number;
  from: string;
  to?: string | null;
  body: string;
  direction: SmsDirection;
  status?: SmsStatus;
  messageSid?: string | null;
  timestamp?: Date;
};

export async function saveSmsMessage(input: SaveSmsInput): Promise<string> {
  const db = getDb();
  const id = input.messageSid || `sms-${generateId()}`;

  if (input.messageSid) {
    const [existing] = await db
      .select({ id: smsMessages.id })
      .from(smsMessages)
      .where(eq(smsMessages.messageSid, input.messageSid))
      .limit(1);
    if (existing) return existing.id;
  }

  await db.insert(smsMessages).values({
    id,
    userId: input.userId,
    from: input.from,
    to: input.to ?? null,
    body: input.body,
    direction: input.direction,
    status: input.status ?? (input.direction === 'out' ? 'sent' : 'received'),
    messageSid: input.messageSid ?? null,
    timestamp: input.timestamp ?? new Date(),
  });

  return id;
}

export async function updateSmsStatusBySid(
  messageSid: string,
  status: SmsStatus
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: smsMessages.id })
    .from(smsMessages)
    .where(eq(smsMessages.messageSid, messageSid))
    .limit(1);
  if (!row) return false;

  await db.update(smsMessages).set({ status }).where(eq(smsMessages.messageSid, messageSid));
  return true;
}

export async function listSmsForUser(userId: number, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.userId, userId))
    .orderBy(desc(smsMessages.timestamp))
    .limit(limit);
}