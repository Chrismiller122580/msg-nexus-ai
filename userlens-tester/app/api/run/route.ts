import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { saveRun, type TestType } from '@/lib/store';
import { executeRun } from '@/lib/runner';

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
  const completed = await executeRun({ ...run });
  saveRun(completed);

  return NextResponse.json({ run: completed });
}