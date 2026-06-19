#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function mask(url) {
  return url.replace(/:([^:@/]+)@/, ':****@');
}

function label(url) {
  if (!url) return 'not set';
  if (url.includes('neon.tech')) return 'Neon';
  if (url.includes('127.0.0.1') || url.includes('localhost')) return 'local Postgres';
  return 'Postgres';
}

async function probe(name, url) {
  if (!url) {
    console.log(`  ${name}: not configured`);
    return false;
  }
  console.log(`  ${name}: ${mask(url)} (${label(url)})`);
  try {
    const sql = postgres(url, { max: 1, connect_timeout: 8 });
    const [row] = await sql`SELECT current_database() as db, count(*)::int as users FROM users`;
    console.log(`    ✓ connected — db=${row.db}, users=${row.users}`);
    await sql.end();
    return true;
  } catch (e) {
    console.log(`    ✗ failed — ${e.message}`);
    return false;
  }
}

loadEnvLocal();

const useNeon = process.env.USE_NEON === 'true' || process.env.USE_NEON === '1';
const localUrl = process.env.DATABASE_URL || '';
const neonUrl = process.env.NEON_DATABASE_URL || '';
const activeUrl = useNeon && neonUrl ? neonUrl : localUrl.includes('neon.tech') ? localUrl : useNeon && neonUrl ? neonUrl : localUrl;

console.log('\nMsgNexus database status\n');
console.log(`Active target: ${label(activeUrl)}${useNeon ? ' (USE_NEON=true)' : ''}\n`);

await probe('DATABASE_URL', localUrl);
await probe('NEON_DATABASE_URL', neonUrl);
console.log('');