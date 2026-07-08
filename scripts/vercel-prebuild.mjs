#!/usr/bin/env node
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
  console.error('   Vercel → Storage → Create Postgres (Neon) → connect to Production');
  console.error('   Then redeploy: https://vercel.com/chrismiller122580s-projects/msgnexus-ai/deployments\n');
  process.exit(1);
}
const isNeon = url.includes('neon.tech');
const source = DB_KEYS.find((k) => process.env[k]?.trim());
console.log(`✓ Database URL resolved from ${source} (${isNeon ? 'Neon' : 'Postgres'})`);