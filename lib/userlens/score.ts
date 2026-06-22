import type { UserlensRunResult } from './client';

export type RunMetrics = {
  smokeOk?: boolean | null;
  a11yViolations?: number | null;
  lighthousePerformance?: number | null;
  lighthouseAccessibility?: number | null;
  lighthouseSeo?: number | null;
  lighthouseBestPractices?: number | null;
  status?: string;
};

export function computeUxScore(metrics: RunMetrics): number | null {
  const scores: number[] = [];

  if (metrics.lighthousePerformance != null) scores.push(metrics.lighthousePerformance);
  if (metrics.lighthouseAccessibility != null) scores.push(metrics.lighthouseAccessibility);
  if (metrics.lighthouseSeo != null) scores.push(metrics.lighthouseSeo);
  if (metrics.lighthouseBestPractices != null) scores.push(metrics.lighthouseBestPractices);

  if (scores.length === 0) {
    if (metrics.smokeOk === false) return 0;
    if (metrics.a11yViolations != null) {
      return Math.max(0, 100 - metrics.a11yViolations * 8);
    }
    return null;
  }

  let score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  if (metrics.smokeOk === false) score = Math.min(score, 25);
  if (metrics.a11yViolations != null && metrics.a11yViolations > 0) {
    score = Math.max(0, score - Math.min(35, metrics.a11yViolations * 5));
  }

  return Math.max(0, Math.min(100, score));
}

export function countCriticalIssues(metrics: RunMetrics, results?: unknown): number {
  let count = 0;
  if (metrics.smokeOk === false) count += 1;
  if ((metrics.a11yViolations ?? 0) > 0) count += metrics.a11yViolations!;
  if (metrics.lighthousePerformance != null && metrics.lighthousePerformance < 50) count += 1;
  if (metrics.lighthouseAccessibility != null && metrics.lighthouseAccessibility < 70) count += 1;

  const r = results as UserlensRunResult | null | undefined;
  const mobile = r?.lighthouseMobile;
  if (mobile?.performance != null && mobile.performance < 50) count += 1;

  return count;
}

export function scoreColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-rose-500';
}

export function scoreLabel(score: number | null): string {
  if (score == null) return '—';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs work';
}