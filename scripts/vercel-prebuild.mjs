#!/usr/bin/env node
if (!process.env.DATABASE_URL) {
  console.error('\n❌ DATABASE_URL is not set.');
  console.error('   Vercel → Storage → Create Postgres → connect to Production');
  console.error('   Then redeploy: https://vercel.com/chrismiller122580s-projects/msgnexus-ai/deployments\n');
  process.exit(1);
}
console.log('✓ DATABASE_URL is set');