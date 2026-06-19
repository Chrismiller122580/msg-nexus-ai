'use client';

import { useState } from 'react';
import {
  Play, RefreshCw, ScanEye, CheckCircle, XCircle, Loader2,
  Activity, Gauge, Accessibility,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  startUserlensRunAction,
  listUserlensRuns,
  getUserlensStatus,
} from '@/app/actions/admin/userlens';
import type { UserlensTestType } from '@/lib/userlens/client';

type RunRow = Awaited<ReturnType<typeof listUserlensRuns>>[number];
type Status = Awaited<ReturnType<typeof getUserlensStatus>>;

const TEST_PRESETS: { label: string; tests: UserlensTestType[]; desc: string }[] = [
  { label: 'Full scan', tests: ['full'], desc: 'Smoke + a11y + Lighthouse' },
  { label: 'Smoke', tests: ['smoke'], desc: 'Page load & HTTP status' },
  { label: 'Accessibility', tests: ['a11y'], desc: 'axe-core violations' },
  { label: 'Lighthouse', tests: ['lighthouse'], desc: 'Performance & SEO scores' },
];

export function AdminUserlensClient({
  status: initialStatus,
  initialRuns,
  canRun,
}: {
  status: Status;
  initialRuns: RunRow[];
  canRun: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [runs, setRuns] = useState(initialRuns);
  const [url, setUrl] = useState(initialStatus.defaultUrl);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<RunRow | null>(null);

  async function refresh() {
    const [s, r] = await Promise.all([getUserlensStatus(), listUserlensRuns()]);
    setStatus(s);
    setRuns(r);
  }

  async function run(tests: UserlensTestType[]) {
    if (!canRun) return;
    setRunning(true);
    try {
      const r = await startUserlensRunAction(url, tests);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Scan complete');
        await refresh();
      }
    } finally {
      setRunning(false);
    }
  }

  const online = status.health.online;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ScanEye size={24} className="text-accent" /> UserLens
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            UX testing — accessibility, performance, and smoke checks
          </p>
        </div>
        <button onClick={refresh} className="btn btn-secondary text-sm flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Service</p>
          <div className="flex items-center gap-2 mt-2">
            {online ? (
              <CheckCircle className="text-emerald-500" size={18} />
            ) : (
              <XCircle className="text-rose-500" size={18} />
            )}
            <span className="font-medium">{online ? 'Online' : 'Offline'}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 truncate">{status.health.url}</p>
          {!online && (
            <p className="text-xs text-rose-500 mt-2">
              Run: <code className="bg-muted px-1 rounded">cd userlens-tester && npm run dev -- -p 3001</code>
            </p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Last run</p>
          <p className="text-2xl font-semibold mt-1 capitalize">
            {status.lastRun?.status ?? '—'}
          </p>
          {status.lastRun?.durationMs && (
            <p className="text-xs text-muted-foreground mt-1">{(status.lastRun.durationMs / 1000).toFixed(1)}s</p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Total runs</p>
          <p className="text-2xl font-semibold mt-1">{runs.length}</p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Run scan</h2>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.vercel.app"
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {TEST_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => run(p.tests)}
              disabled={!canRun || !online || running}
              className="btn btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
              title={p.desc}
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {p.label}
            </button>
          ))}
        </div>
        {!canRun && <p className="text-xs text-muted-foreground">Admin role required to run scans</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Time</th>
              <th className="p-3">URL</th>
              <th className="p-3">Tests</th>
              <th className="p-3">Status</th>
              <th className="p-3">A11y</th>
              <th className="p-3">Perf</th>
              <th className="p-3">Duration</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No scans yet — run your first test above
                </td>
              </tr>
            ) : runs.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="p-3 max-w-[180px] truncate">{r.url}</td>
                <td className="p-3 text-xs">{(r.tests as string[]).join(', ')}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    r.status === 'passed' ? 'bg-emerald-500/15 text-emerald-600'
                    : r.status === 'failed' ? 'bg-rose-500/15 text-rose-600'
                    : 'bg-muted'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-3">{r.a11yViolations ?? '—'}</td>
                <td className="p-3">{r.lighthousePerformance != null ? `${r.lighthousePerformance}` : '—'}</td>
                <td className="p-3 text-xs">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                <td className="p-3">
                  <button onClick={() => setSelected(r)} className="text-xs text-accent hover:underline">Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card p-5 space-y-4">
          <div className="flex justify-between items-start">
            <h2 className="font-semibold">Run #{selected.id} details</h2>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <p className="text-sm text-muted-foreground">{selected.url}</p>
          {selected.error && <p className="text-sm text-rose-500">{selected.error}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {selected.lighthousePerformance != null && (
              <div className="bg-muted/50 rounded-xl p-4">
                <Gauge size={16} className="text-violet-500 mb-1" />
                <p className="text-xs text-muted-foreground">Performance</p>
                <p className="text-xl font-semibold">{selected.lighthousePerformance}</p>
              </div>
            )}
            {selected.lighthouseAccessibility != null && (
              <div className="bg-muted/50 rounded-xl p-4">
                <Accessibility size={16} className="text-blue-500 mb-1" />
                <p className="text-xs text-muted-foreground">Accessibility</p>
                <p className="text-xl font-semibold">{selected.lighthouseAccessibility}</p>
              </div>
            )}
            {selected.lighthouseSeo != null && (
              <div className="bg-muted/50 rounded-xl p-4">
                <Activity size={16} className="text-emerald-500 mb-1" />
                <p className="text-xs text-muted-foreground">SEO</p>
                <p className="text-xl font-semibold">{selected.lighthouseSeo}</p>
              </div>
            )}
            {selected.a11yViolations != null && (
              <div className="bg-muted/50 rounded-xl p-4">
                <Accessibility size={16} className="text-amber-500 mb-1" />
                <p className="text-xs text-muted-foreground">axe violations</p>
                <p className="text-xl font-semibold">{selected.a11yViolations}</p>
              </div>
            )}
          </div>
          {selected.results && (
            <pre className="text-xs bg-muted p-4 rounded-xl overflow-auto max-h-64 font-mono">
              {JSON.stringify(selected.results, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}