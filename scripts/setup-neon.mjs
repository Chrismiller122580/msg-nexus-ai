#!/usr/bin/env node
/**
 * Wire Neon into .env.local and push schema.
 * Usage:
 *   node scripts/setup-neon.mjs "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
 *   node scripts/setup-neon.mjs --from-vercel   # after: npx vercel env pull
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import postgres from 'postgres';

const args = process.argv.slice(2);
const fromVercel = args.includes('--from-vercel');
const activate = !args.includes('--no-activate');
let neonUrl = args.find((a) => a.startsWith('postgresql://') || a.startsWith('postgres://'));

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function upsertEnvLocal(updates) {
  const path = resolve(process.cwd(), '.env.local');
  let content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value}"`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) content = content.replace(re, line);
    else content += (content.endsWith('\n') ? '' : '\n') + line + '\n';
  }
  writeFileSync(path, content);
}

if (fromVercel) {
  const pulled = loadEnvFile(resolve(process.cwd(), '.env.local'));
  neonUrl =
    pulled.DATABASE_URL ||
    pulled.POSTGRES_URL ||
    pulled.POSTGRES_URL_NON_POOLING ||
    pulled.POSTGRES_URL_NO_SSL ||
    pulled.NEON_DATABASE_URL;
  if (!neonUrl?.includes('neon.tech')) {
    console.error('\n❌ No Neon DATABASE_URL in .env.local');
    console.error('   Run: npx vercel login && npx vercel link && npx vercel env pull .env.local\n');
    process.exit(1);
  }
}

if (!neonUrl) {
  console.error('\nUsage: node scripts/setup-neon.mjs "postgresql://...@ep-xxx.neon.tech/...?sslmode=require"');
  console.error('   Or: npx vercel env pull .env.local && node scripts/setup-neon.mjs --from-vercel\n');
  process.exit(1);
}

console.log('\n🔌 Testing Neon connection...');
try {
  const sql = postgres(neonUrl, { max: 1, connect_timeout: 15 });
  const [row] = await sql`SELECT version() as v`;
  console.log('✓ Connected to Neon');
  await sql.end();
} catch (e) {
  console.error('❌ Connection failed:', e.message);
  process.exit(1);
}

const updates = { NEON_DATABASE_URL: neonUrl };
if (activate) updates.USE_NEON = 'true';
upsertEnvLocal(updates);
console.log('✓ Updated .env.local (NEON_DATABASE_URL' + (activate ? ', USE_NEON=true' : '') + ')');

console.log('\n📦 Pushing schema to Neon...');
const push = spawnSync('npm', ['run', 'db:push'], {
  stdio: 'inherit',
  env: { ...process.env, USE_NEON: 'true', NEON_DATABASE_URL: neonUrl },
});
if (push.status !== 0) process.exit(push.status ?? 1);

console.log('\n✅ Neon is wired up. Restart dev server: npm run dev');
console.log('   Check status anytime: npm run db:status\n');