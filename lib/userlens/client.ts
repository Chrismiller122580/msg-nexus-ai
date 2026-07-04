export type UserlensTestType = 'smoke' | 'a11y' | 'lighthouse' | 'mobile' | 'full';

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
  lighthouseMobile?: {
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

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response from UserLens service (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from UserLens service (HTTP ${res.status})`);
  }
}

async function pollUserlensRun(base: string, runId: string, timeoutMs = 300000): Promise<UserlensRunResult> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/runs/${runId}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      throw new Error(`UserLens poll error (${res.status})`);
    }
    const data = await parseJsonResponse<{ run: UserlensRunResult }>(res);
    if (data.run.status !== 'running') return data.run;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('UserLens scan timed out after 5 minutes');
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
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok && res.status !== 202) {
    const err = await parseJsonResponse<{ error?: string }>(res).catch(() => ({} as { error?: string }));
    throw new Error(err.error || `UserLens service error (${res.status})`);
  }

  const data = await parseJsonResponse<{ run: UserlensRunResult; accepted?: boolean }>(res);
  if (data.run.status === 'running' || data.accepted) {
    return pollUserlensRun(base, data.run.id);
  }
  return data.run;
}

export async function fetchUserlensRuns(): Promise<UserlensRunResult[]> {
  const base = getUserlensServiceUrl();
  const res = await fetch(`${base}/api/runs`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json() as { runs: UserlensRunResult[] };
  return data.runs ?? [];
}