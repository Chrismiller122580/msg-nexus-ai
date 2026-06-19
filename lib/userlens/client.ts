export type UserlensTestType = 'smoke' | 'a11y' | 'lighthouse' | 'full';

export interface UserlensRunResult {
  id: string;
  url: string;
  tests: UserlensTestType[];
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  smoke?: { ok: boolean; statusCode?: number; title?: string; error?: string };
  a11y?: { violations: number; passes: number; incomplete: number; summary: unknown[] };
  lighthouse?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  error?: string;
}

export function getUserlensServiceUrl(): string {
  return (
    process.env.USERLENS_SERVICE_URL ||
    process.env.NEXT_PUBLIC_USERLENS_SERVICE_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '');
}

export async function checkUserlensHealth(): Promise<{
  online: boolean;
  service?: string;
  version?: string;
  url: string;
  error?: string;
}> {
  const base = getUserlensServiceUrl();
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { online: false, url: base, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { online: true, url: base, service: data.service, version: data.version };
  } catch (e) {
    return { online: false, url: base, error: e instanceof Error ? e.message : 'Unreachable' };
  }
}

export async function triggerUserlensRun(
  url: string,
  tests: UserlensTestType[]
): Promise<UserlensRunResult> {
  const base = getUserlensServiceUrl();
  const res = await fetch(`${base}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, tests }),
    signal: AbortSignal.timeout(300000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `UserLens service error (${res.status})`);
  }

  const data = await res.json() as { run: UserlensRunResult };
  return data.run;
}

export async function fetchUserlensRuns(): Promise<UserlensRunResult[]> {
  const base = getUserlensServiceUrl();
  const res = await fetch(`${base}/api/runs`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json() as { runs: UserlensRunResult[] };
  return data.runs ?? [];
}