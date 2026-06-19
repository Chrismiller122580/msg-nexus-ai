import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import type { TestType, UserlensRun } from './store';

const require = createRequire(import.meta.url);

function loadAxeSource() {
  const axePath = require.resolve('axe-core/axe.min.js');
  return readFileSync(axePath, 'utf8');
}

async function runSmoke(url: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    return {
      ok: response !== null && response.ok(),
      statusCode: response?.status(),
      title,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Smoke test failed' };
  } finally {
    await browser.close();
  }
}

async function runA11y(url: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    const axeSource = loadAxeSource();
    const results = await page.evaluate(async (source) => {
      const fn = new Function(`${source}; return axe.run(document);`);
      return fn();
    }, axeSource);

    const r = results as { violations: unknown[]; passes: unknown[]; incomplete: unknown[] };
    return {
      violations: r.violations?.length ?? 0,
      passes: r.passes?.length ?? 0,
      incomplete: r.incomplete?.length ?? 0,
      summary: (r.violations ?? []).slice(0, 10).map((v: { id: string; impact: string; description: string; nodes: unknown[] }) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes?.length ?? 0,
      })),
    };
  } finally {
    await browser.close();
  }
}

async function runLighthouse(url: string) {
  const chromeLauncher = await import('chrome-launcher');
  const lighthouse = (await import('lighthouse')).default;
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
    });
    const cats = result?.lhr?.categories ?? {};
    const score = (cat: { score?: number | null } | undefined) =>
      Math.round((cat?.score ?? 0) * 100);
    return {
      performance: score(cats.performance),
      accessibility: score(cats.accessibility),
      bestPractices: score(cats['best-practices']),
      seo: score(cats.seo),
    };
  } finally {
    await chrome.kill();
  }
}

export async function executeRun(run: UserlensRun): Promise<UserlensRun> {
  const start = Date.now();
  const tests = run.tests.includes('full')
    ? (['smoke', 'a11y', 'lighthouse'] as TestType[])
    : run.tests;

  try {
    if (tests.includes('smoke')) run.smoke = await runSmoke(run.url);
    if (tests.includes('a11y')) run.a11y = await runA11y(run.url);
    if (tests.includes('lighthouse')) run.lighthouse = await runLighthouse(run.url);

    const failed =
      (run.smoke && !run.smoke.ok) ||
      (run.a11y && run.a11y.violations > 0) ||
      (run.lighthouse && run.lighthouse.performance < 50);

    run.status = failed ? 'failed' : 'passed';
  } catch (e) {
    run.status = 'failed';
    run.error = e instanceof Error ? e.message : 'Run failed';
  }

  run.durationMs = Date.now() - start;
  run.completedAt = new Date().toISOString();
  return run;
}