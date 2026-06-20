#!/usr/bin/env node
/**
 * Full Neon bootstrap after Vercel auth:
 *   npx vercel login
 *   node scripts/bootstrap-neon.mjs
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

function run(cmd, args, opts = {}) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function whoami() {
  const r = spawnSync('npx', ['vercel', 'whoami'], { encoding: 'utf8' });
  return r.status === 0;
}

if (!whoami()) {
  console.error('\n❌ Not logged in to Vercel. Run: npx vercel login\n');
  process.exit(1);
}

const projectFile = resolve(process.cwd(), '.vercel/project.json');
if (!existsSync(projectFile)) {
  run('npx', ['vercel', 'link', '--yes', '--project', 'msgnexus-ai']);
}

run('npx', ['vercel', 'env', 'pull', '.env.local', '--yes']);

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
const hasNeon = /neon\.tech/.test(env) || /NEON_DATABASE_URL=.+[^"]/.test(env);

if (!hasNeon) {
  console.log('\n⚠ No Neon URL in .env.local yet.');
  console.log('  Vercel dashboard → msgnexus-ai → Storage → Create Postgres → Connect');
  console.log('  Then re-run: node scripts/bootstrap-neon.mjs\n');
  process.exit(1);
}

run('node', ['scripts/setup-neon.mjs', '--from-vercel']);
console.log('\n✅ Done. Run: npm run db:status\n');