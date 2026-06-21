'use client';

import { useMemo, useState } from 'react';
import {
  Play, RefreshCw, ScanEye, CheckCircle, XCircle, Loader2,
  Activity, Gauge, Accessibility, Copy, RotateCcw, Smartphone,
  TrendingUp, AlertTriangle, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  startUserlensRunAction,
  listUserlensRuns,
  getUserlensStatus,
} from '@/app/actions/admin/userlens';
import type { UserlensTestType } from '@/lib/userlens/client';
import { buildComposerPrompt } from '@/lib/userlens/composer';
import { computeUxScore, countCriticalIssues, scoreColor, scoreLabel } from '@/lib/userlens/score';
import type { UserlensRunResult } from '@/lib/userlens/client';

type RunRow = Awaited<ReturnType<typeof listUserlensRuns>>[number];
type Status = Awaited<ReturnType<typeof getUserlensStatus>>;

const TEST_PRESETS: { label: string; tests: UserlensTestType[]; desc: string }[] = [
  { label: 'Analyze Now', tests: ['full'], desc: 'Smoke + a11y + desktop & mobile Lighthouse' },
  { label: 'Smoke', tests: ['smoke'], desc: 'Page load & HTTP status' },
  { label: 'Accessibility', tests: ['a11y'], desc: 'axe-core violations' },
  { label: 'Desktop', tests: ['lighthouse'], desc: 'Desktop performance & SEO' },
  { label: 'Mobile', tests: ['mobile'], desc: 'Mobile viewport & touch UX' },
];

function ScoreTrendChart({ runs }: { runs: RunRow[] }) {
  const data = useMemo(() => {
    return [...runs]
      .filter((r) => computeUxScore(r) != null)
      .slice(0, 14)
      .reverse()
      .map((r) => ({
        label: new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: computeUxScore(r) ?? 0,
      }));
  }, [runs]);

  const max = 100;

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Run scans to see UX score trends</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-14 text-xs text-muted-foreground shrink-0">{d.label}</span>
          <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
            <div
              className={`h-full rounded-lg transition-all ${
                d.score >= 80 ? 'bg-emerald-500' : d.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${(d.score / max) * 100}%` }}
            />
          </div>
          <span className={`w-10 text-right font-medium text-xs ${scoreColor(d.score)}`}>{d.score}</span>
        </div>
      ))}
    </div>
  );
}

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
  const [composerText, setComposerText] = useState<string | null>(null);

  const stats = useMemo(() => {
    const scored = runs.map((r) => computeUxScore(r)).filter((s): s is number => s != null);
    const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
    const critical = runs.reduce((sum, r) => sum + countCriticalIssues(r, r.results), 0);
    const lastTested = runs[0]?.createdAt ?? null;
    return { avgScore, critical, lastTested };
  }, [runs]);

  async function refresh() {
    const [s, r] = await Promise.all([getUserlensStatus(), listUserlensRuns()]);
    setStatus(s);
    setRuns(r);
  }

  async function run(tests: UserlensTestType[], targetUrl?: string) {
    if (!canRun) return;
    const scanUrl = targetUrl ?? url;
    setRunning(true);
    try {
      const r = await startUserlensRunAction(scanUrl, tests);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Scan complete');
        await refresh();
      }
    } finally {
      setRunning(false);
    }
  }

  function exportToComposer(run: RunRow) {
    const text = buildComposerPrompt(run);
    setComposerText(text);
    setSelected(run);
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied Composer fix instructions'),
      () => toast.error('Copy failed — use the text area below'),
    );
  }

  const online = status.health.online;
  const selectedScore = selected ? computeUxScore(selected) : null;
  const selectedResults = selected?.results as UserlensRunResult | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ScanEye size={24} className="text-accent" /> UserLens
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live UX auditor — accessibility, performance, mobile journeys, Composer-ready fixes
          </p>
        </div>
        <button onClick={refresh} className="btn btn-secondary text-sm flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <TrendingUp size={14} /> Avg UX Score
          </p>
          <p className={`text-3xl font-semibold mt-1 ${scoreColor(stats.avgScore)}`}>
            {stats.avgScore ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{scoreLabel(stats.avgScore)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <AlertTriangle size={14} /> Critical issues
          </p>
          <p className="text-3xl font-semibold mt-1">{stats.critical}</p>
          <p className="text-xs text-muted-foreground mt-1">Across all runs</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Last tested</p>
          <p className="text-lg font-semibold mt-1">
            {stats.lastTested
              ? new Date(stats.lastTested).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{runs.length} total runs</p>
        </div>
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
          {!online && (
            <p className="text-xs text-rose-500 mt-2">
              <code className="bg-muted px-1 rounded text-[10px]">cd userlens-tester && npm run dev -- -p 3001</code>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Activity size={18} /> UX Score trend
          </h2>
          <ScoreTrendChart runs={runs} />
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Analyze live site</h2>
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
                className={`text-sm disabled:opacity-50 flex items-center gap-2 ${
                  p.label === 'Analyze Now' ? 'btn btn-primary' : 'btn btn-secondary'
                }`}
                title={p.desc}
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {p.label}
              </button>
            ))}
          </div>
          {!canRun && <p className="text-xs text-muted-foreground">Admin role required to run scans</p>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Scan history</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Time</th>
              <th className="p-3">URL</th>
              <th className="p-3">UX</th>
              <th className="p-3">Status</th>
              <th className="p-3">A11y</th>
              <th className="p-3">Perf</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Duration</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No scans yet — paste a URL above and click Analyze Now
                </td>
              </tr>
            ) : runs.map((r) => {
              const ux = computeUxScore(r);
              const mobile = (r.results as UserlensRunResult | undefined)?.lighthouseMobile?.performance;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 max-w-[160px] truncate" title={r.url}>{r.url}</td>
                  <td className={`p-3 font-semibold ${scoreColor(ux)}`}>{ux ?? '—'}</td>
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
                  <td className="p-3">{r.lighthousePerformance != null ? r.lighthousePerformance : '—'}</td>
                  <td className="p-3">{mobile != null ? mobile : '—'}</td>
                  <td className="p-3 text-xs">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportToComposer(r)}
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                        title="Copy fix instructions for Cursor Composer"
                      >
                        <Sparkles size={12} /> Composer
                      </button>
                      <button
                        onClick={() => run(['full'], r.url)}
                        disabled={!canRun || !online || running}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
                        title="Re-test this URL"
                      >
                        <RotateCcw size={12} /> Re-test
                      </button>
                      <button onClick={() => setSelected(r)} className="text-xs text-muted-foreground hover:underline">
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card p-5 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                Run #{selected.id}
                {selectedScore != null && (
                  <span className={`text-sm font-normal ${scoreColor(selectedScore)}`}>
                    · UX {selectedScore}/100 ({scoreLabel(selectedScore)})
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{selected.url}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => exportToComposer(selected)}
                className="btn btn-primary text-xs flex items-center gap-1"
              >
                <Copy size={12} /> Export to Composer
              </button>
              <button onClick={() => { setSelected(null); setComposerText(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
          </div>

          {selected.error && <p className="text-sm text-rose-500">{selected.error}</p>}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {selected.lighthousePerformance != null && (
              <div className="bg-muted/50 rounded-xl p-4">
                <Gauge size={16} className="text-violet-500 mb-1" />
                <p className="text-xs text-muted-foreground">Desktop perf</p>
                <p className="text-xl font-semibold">{selected.lighthousePerformance}</p>
              </div>
            )}
            {selectedResults?.lighthouseMobile?.performance != null && (
              <div className="bg-muted/50 rounded-xl p-4">
                <Smartphone size={16} className="text-indigo-500 mb-1" />
                <p className="text-xs text-muted-foreground">Mobile perf</p>
                <p className="text-xl font-semibold">{selectedResults.lighthouseMobile.performance}</p>
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

          {composerText && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Sparkles size={14} className="text-accent" /> Composer fix instructions
              </p>
              <textarea
                readOnly
                value={composerText}
                className="w-full text-xs bg-muted p-4 rounded-xl font-mono min-h-[200px] border border-border"
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}

          {selected.results && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw JSON results</summary>
              <pre className="bg-muted p-4 rounded-xl overflow-auto max-h-64 font-mono mt-2">
                {JSON.stringify(selected.results, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}