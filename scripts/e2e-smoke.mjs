#!/usr/bin/env node
/**
 * Smoke test: login → onboarding → inbox
 * Run: node scripts/e2e-smoke.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = process.env.APP_URL || 'http://localhost:3000';
const root = process.cwd();

function actionId(route, name) {
  const p = join(root, `.next/dev/server/app/${route}/page/server-reference-manifest.json`);
  if (!existsSync(p)) throw new Error(`No manifest for /${route} — start dev server and visit the page first`);
  const m = JSON.parse(readFileSync(p, 'utf8'));
  for (const [id, entry] of Object.entries(m.node)) {
    if (entry.exportedName === name) return id;
  }
  throw new Error(`Action ${name} not found on /${route}`);
}

const jar = new Map();

async function call(route, name, args) {
  const res = await fetch(`${BASE}/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Next-Action': actionId(route, name),
      Accept: 'text/x-component',
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    },
    body: JSON.stringify(args),
  });
  for (const h of res.headers.getSetCookie?.() ?? []) {
    const [pair] = h.split(';');
    const [k, v] = pair.split('=');
    jar.set(k, v);
  }
  return { status: res.status, text: await res.text() };
}

async function main() {
  await fetch(`${BASE}/login`);
  await fetch(`${BASE}/inbox`);

  const email = `e2e-${Date.now()}@msgnexus.ai`;
  const results = [];

  const login = await call('login', 'loginAction', [email, 'demo']);
  results.push({ step: 'login', ok: login.status === 200 && jar.has('msgnexus-session') });

  const settings = await fetch(`${BASE}/settings`, {
    headers: { Cookie: `msgnexus-session=${jar.get('msgnexus-session')}` },
  });
  results.push({ step: 'settings', ok: settings.status === 200 });

  const user = await call('inbox', 'getCurrentUserAction', []);
  results.push({ step: 'getCurrentUser', ok: user.status === 200 && user.text.includes(email) });

  const msgs = await call('inbox', 'getUserMessages', []);
  results.push({ step: 'getUserMessages', ok: msgs.status === 200 && !msgs.text.includes('Unauthorized') });

  const inboxPage = await fetch(`${BASE}/inbox`, {
    headers: { Cookie: `msgnexus-session=${jar.get('msgnexus-session')}` },
  });
  results.push({ step: 'inbox page', ok: inboxPage.status === 200 });

  console.log(`\nE2E smoke test — ${email} (session ${jar.get('msgnexus-session')})\n`);
  let allOk = true;
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.step}`);
    if (!r.ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E failed:', err.message);
  process.exit(1);
});