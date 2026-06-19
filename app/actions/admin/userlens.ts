'use server';

import { getDb, userlensRuns } from '@/db';
import { requirePermission } from '@/lib/admin';
import { logAudit } from '@/lib/audit';
import {
  checkUserlensHealth,
  triggerUserlensRun,
  fetchUserlensRuns,
  type UserlensTestType,
} from '@/lib/userlens/client';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

function mapRun(row: typeof userlensRuns.$inferSelect) {
  return {
    id: row.id,
    externalId: row.externalId,
    url: row.url,
    tests: Array.isArray(row.tests) ? row.tests : [],
    status: row.status,
    smokeOk: row.smokeOk,
    a11yViolations: row.a11yViolations,
    lighthousePerformance: row.lighthousePerformance,
    lighthouseAccessibility: row.lighthouseAccessibility,
    lighthouseSeo: row.lighthouseSeo,
    lighthouseBestPractices: row.lighthouseBestPractices,
    durationMs: row.durationMs,
    error: row.error,
    results: row.results,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

export async function getUserlensStatus() {
  await requirePermission('userlens.read');
  const health = await checkUserlensHealth();
  const db = getDb();
  const [lastRun] = await db.select().from(userlensRuns).orderBy(desc(userlensRuns.createdAt)).limit(1);
  const defaultUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    health,
    defaultUrl,
    lastRun: lastRun ? mapRun(lastRun) : null,
  };
}

export async function listUserlensRuns(limit = 30) {
  await requirePermission('userlens.read');
  const db = getDb();
  const rows = await db.select().from(userlensRuns).orderBy(desc(userlensRuns.createdAt)).limit(limit);
  return rows.map((r: (typeof rows)[number]) => mapRun(r));
}

export async function startUserlensRunAction(
  url: string,
  tests: UserlensTestType[]
): Promise<{ success?: boolean; error?: string; runId?: number }> {
  const admin = await requirePermission('userlens.write');
  const health = await checkUserlensHealth();
  if (!health.online) {
    return { error: `UserLens service offline at ${health.url}. Start userlens-tester on port 3001.` };
  }

  const db = getDb();
  const [pending] = await db.insert(userlensRuns).values({
    url: url.trim(),
    tests,
    status: 'running',
    triggeredByUserId: admin.id,
  }).returning();

  try {
    const result = await triggerUserlensRun(url.trim(), tests);

    await db.update(userlensRuns).set({
      externalId: result.id,
      status: result.status,
      smokeOk: result.smoke?.ok ?? null,
      a11yViolations: result.a11y?.violations ?? null,
      lighthousePerformance: result.lighthouse?.performance ?? null,
      lighthouseAccessibility: result.lighthouse?.accessibility ?? null,
      lighthouseSeo: result.lighthouse?.seo ?? null,
      lighthouseBestPractices: result.lighthouse?.bestPractices ?? null,
      durationMs: result.durationMs ?? null,
      results: result,
      error: result.error ?? null,
      completedAt: new Date(),
    }).where(eq(userlensRuns.id, pending.id));

    await logAudit({
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: 'userlens.run',
      resource: 'userlens_run',
      resourceId: String(pending.id),
      metadata: { url, tests, status: result.status },
    });

    revalidatePath('/admin/userlens');
    return { success: true, runId: pending.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Run failed';
    await db.update(userlensRuns).set({
      status: 'failed',
      error: message,
      completedAt: new Date(),
    }).where(eq(userlensRuns.id, pending.id));
    return { error: message };
  }
}

export async function syncUserlensRunsAction() {
  await requirePermission('userlens.read');
  const remote = await fetchUserlensRuns();
  return { count: remote.length, runs: remote };
}

export async function getUserlensRunDetail(id: number) {
  await requirePermission('userlens.read');
  const db = getDb();
  const [row] = await db.select().from(userlensRuns).where(eq(userlensRuns.id, id)).limit(1);
  return row ? mapRun(row) : null;
}