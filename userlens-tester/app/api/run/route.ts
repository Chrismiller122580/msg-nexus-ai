import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { saveRun, type TestType } from '@/lib/store';
import { executeRun } from '@/lib/runner';

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { url?: string; tests?: TestType[] };
  const url = body.url?.trim();
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Valid url is required' }, { status: 400 });
  }

  const tests: TestType[] = body.tests?.length ? body.tests : ['full'];
  const run = {
    id: randomUUID(),
    url,
    tests,
    status: 'running' as const,
    startedAt: new Date().toISOString(),
  };

  saveRun(run);

  // Return immediately — full scans can take 1–3 min (Codespaces proxy times out on long requests)
  void executeRun({ ...run })
    .then((completed) => saveRun(completed))
    .catch((e) => {
      saveRun({
        ...run,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Run failed',
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(run.startedAt).getTime(),
      });
    });

  return NextResponse.json({ run, accepted: true }, { status: 202 });
}