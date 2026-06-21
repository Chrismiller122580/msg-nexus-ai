export type TestType = 'smoke' | 'a11y' | 'lighthouse' | 'mobile' | 'full';

export type RunStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface UserlensRun {
  id: string;
  url: string;
  tests: TestType[];
  status: RunStatus;
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

const runs = new Map<string, UserlensRun>();
const MAX_RUNS = 100;

export function saveRun(run: UserlensRun) {
  runs.set(run.id, run);
  if (runs.size > MAX_RUNS) {
    const oldest = [...runs.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
    if (oldest) runs.delete(oldest.id);
  }
}

export function getRun(id: string) {
  return runs.get(id);
}

export function listRuns(limit = 50) {
  return [...runs.values()]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}