#!/usr/bin/env node
const url = process.env.DATABASE_URL || '';
if (!url) {
  console.error('\n❌ DATABASE_URL is not set.');
  console.error('   Vercel → Storage → Create Postgres (Neon) → connect to Production');
  console.error('   Then redeploy: https://vercel.com/chrismiller122580s-projects/msgnexus-ai/deployments\n');
  process.exit(1);
}
const isNeon = url.includes('neon.tech');
console.log(`✓ DATABASE_URL is set (${isNeon ? 'Neon' : 'Postgres'})`);