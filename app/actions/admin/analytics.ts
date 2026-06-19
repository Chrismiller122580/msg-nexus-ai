'use server';

import { getDb, users, messages, insights, auditLogs } from '@/db';
import { requireAdmin } from '@/lib/admin';
import { sql, gte, count, desc } from 'drizzle-orm';

export async function getAdminAnalytics() {
  await requireAdmin();
  const db = getDb();

  const days = 14;
  const start = new Date();
  start.setDate(start.getDate() - days);

  const signupsByDay = await db
    .select({
      day: sql<string>`date_trunc('day', ${users.createdAt})::date::text`,
      count: count(),
    })
    .from(users)
    .where(gte(users.createdAt, start))
    .groupBy(sql`date_trunc('day', ${users.createdAt})`)
    .orderBy(sql`date_trunc('day', ${users.createdAt})`);

  const messagesByDay = await db
    .select({
      day: sql<string>`date_trunc('day', ${messages.createdAt})::date::text`,
      count: count(),
    })
    .from(messages)
    .where(gte(messages.createdAt, start))
    .groupBy(sql`date_trunc('day', ${messages.createdAt})`)
    .orderBy(sql`date_trunc('day', ${messages.createdAt})`);

  const insightsByCategory = await db
    .select({ category: insights.category, count: count() })
    .from(insights)
    .groupBy(insights.category);

  const topActions = await db
    .select({ action: auditLogs.action, count: count() })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, start))
    .groupBy(auditLogs.action)
    .orderBy(desc(count()))
    .limit(10);

  const perUser = await db
    .select({ count: count() })
    .from(messages)
    .groupBy(messages.userId);

  const avgMessagesPerUser = perUser.length
    ? perUser.reduce((sum: number, r: { count: number }) => sum + (r.count ?? 0), 0) / perUser.length
    : 0;

  type DayCount = { day: string; count: number };
  type CategoryCount = { category: string | null; count: number };
  type ActionCount = { action: string; count: number };

  return {
    signupsByDay: signupsByDay.map((r: DayCount) => ({ day: r.day, count: Number(r.count) })),
    messagesByDay: messagesByDay.map((r: DayCount) => ({ day: r.day, count: Number(r.count) })),
    insightsByCategory: insightsByCategory.map((r: CategoryCount) => ({ category: r.category ?? 'other', count: Number(r.count) })),
    topAuditActions: topActions.map((r: ActionCount) => ({ action: r.action, count: Number(r.count) })),
    avgMessagesPerUser: Math.round(avgMessagesPerUser * 10) / 10,
  };
}