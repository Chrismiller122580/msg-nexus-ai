#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const script of ['scripts/patch-inbox-threads.mjs', 'scripts/patch-dashboard-health.mjs']) {
  const patch = spawnSync(process.execPath, [join(root, script)], { stdio: 'inherit' });
  if (patch.status !== 0) process.exit(patch.status || 1);
}

const DB_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL_NO_SSL',
  'POSTGRES_PRISMA_URL',
  'NEON_DATABASE_URL',
];
const url = DB_KEYS.map((k) => process.env[k]?.trim()).find(Boolean) || '';
if (!url) {
  console.error('\n❌ No Postgres URL found (DATABASE_URL or POSTGRES_URL_*).');
  process.exit(1);
}
const isNeon = url.includes('neon.tech');
const source = DB_KEYS.find((k) => process.env[k]?.trim());
console.log(`✓ Database URL resolved from ${source} (${isNeon ? 'Neon' : 'Postgres'})`);
