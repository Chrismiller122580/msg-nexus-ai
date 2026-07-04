'use client';

import { useCallback, useEffect, useState } from 'react';

type TestType = 'smoke' | 'a11y' | 'lighthouse' | 'mobile' | 'full';

type Run = {
  id: string;
  url: string;
  tests: TestType[];
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  smoke?: { ok: boolean; statusCode?: number; title?: string };
  a11y?: { violations: number };
  lighthouse?: { performance: number; accessibility: number; seo: number };
  lighthouseMobile?: { performance: number };
  error?: string;
};

type Health = {
  ok: boolean;
  service: string;
  version: string;
  tests: string[];
};

const PRESETS: { label: string; tests: TestType[] }[] = [
  { label: 'Full scan', tests: ['full'] },
  { label: 'Smoke', tests: ['smoke'] },
  { label: 'A11y', tests: ['a11y'] },
  { label: 'Desktop', tests: ['lighthouse'] },
  { label: 'Mobile', tests: ['mobile'] },
];

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Server returned empty response (HTTP ${res.status}). The scan may still be running — refresh history.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid server response (HTTP ${res.status})`);
  }
}

async function pollRun(runId: string): Promise<Run> {
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/runs/${runId}`);
    const data = await parseJson<{ run: Run }>(res);
    if (data.run.status !== 'running') return data.run;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Scan timed out after 5 minutes — check history for partial results');
}

function uxScore(run: Run): number | null {
  const scores: number[] = [];
  if (run.lighthouse?.performance != null) scores.push(run.lighthouse.performance);
  if (run.lighthouse?.accessibility != null) scores.push(run.lighthouse.accessibility);
  if (run.lighthouse?.seo != null) scores.push(run.lighthouse.seo);
  if (scores.length === 0) {
    if (run.smoke?.ok === false) return 0;
    if (run.a11y?.violations != null) return Math.max(0, 100 - run.a11y.violations * 8);
    return null;
  }
  let s = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  if (run.smoke?.ok === false) s = Math.min(s, 25);
  if (run.a11y?.violations) s = Math.max(0, s - Math.min(35, run.a11y.violations * 5));
  return Math.max(0, Math.min(100, s));
}

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [url, setUrl] = useState('https://vercel.com');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [hRes, rRes] = await Promise.all([fetch('/api/health'), fetch('/api/runs')]);
      const [h, r] = await Promise.all([
        parseJson<Health>(hRes),
        parseJson<{ runs: Run[] }>(rRes),
      ]);
      setHealth(h);
      setRuns(r.runs ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runScan(tests: TestType[]) {
    setRunning(true);
    setError(null);
    setProgress('Starting scan…');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tests }),
      });
      const data = await parseJson<{ run: Run; error?: string; accepted?: boolean }>(res);
      if (!res.ok && res.status !== 202) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.run.status === 'running' || data.accepted) {
        setProgress('Scan running — polling for results (1–3 min for full scan)…');
        await pollRun(data.run.id);
      }
      await refresh();
      setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setProgress(null);
      await refresh();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <span className="text-accent">◉</span> UserLens Tester
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Headless UX scan API — Playwright, axe-core, Lighthouse
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${health?.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-muted-foreground">{health?.ok ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Run scan</h2>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-site.vercel.app"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => runScan(p.tests)}
                disabled={running}
                className={`btn ${p.label === 'Full scan' ? 'btn-primary' : 'btn-secondary'}`}
              >
                {running ? 'Scanning…' : p.label}
              </button>
            ))}
          </div>
          {progress && <p className="text-sm text-accent">{progress}</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Full scan runs smoke + axe accessibility + desktop &amp; mobile Lighthouse (may take 1–3 min).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Service</p>
            <p className="font-medium mt-1">{health?.service ?? '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="font-medium mt-1">{health?.version ?? '—'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Recent runs</p>
            <p className="font-medium mt-1">{runs.length}</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold">Scan history</h2>
            <button onClick={refresh} className="text-xs text-accent hover:underline">Refresh</button>
          </div>
          {runs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No scans yet — run one above</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">URL</th>
                  <th className="p-3">UX</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">A11y</th>
                  <th className="p-3">Perf</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const score = uxScore(r);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 max-w-[140px] truncate" title={r.url}>{r.url}</td>
                      <td className="p-3 font-semibold">{score ?? '—'}</td>
                      <td className="p-3 capitalize">{r.status}</td>
                      <td className="p-3">{r.a11y?.violations ?? '—'}</td>
                      <td className="p-3">{r.lighthouse?.performance ?? '—'}</td>
                      <td className="p-3">{r.lighthouseMobile?.performance ?? '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5 space-y-2">
          <h2 className="font-semibold text-sm">API endpoints</h2>
          <ul className="text-xs font-mono text-muted-foreground space-y-1">
            <li><span className="text-emerald-600">GET</span> /api/health</li>
            <li><span className="text-blue-600">POST</span> /api/run — {'{ url, tests }'}</li>
            <li><span className="text-emerald-600">GET</span> /api/runs</li>
            <li><span className="text-emerald-600">GET</span> /api/runs/:id — poll status</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2">
            Point MsgNexus <code className="bg-muted px-1 rounded">USERLENS_SERVICE_URL</code> at this service.
            Admin UI: <code className="bg-muted px-1 rounded">/admin/userlens</code>
          </p>
        </div>
      </main>
    </div>
  );
}