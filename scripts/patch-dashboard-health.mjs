#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'app/dashboard/DashboardClient.tsx');
if (!existsSync(file)) {
  console.log('skip dashboard health patch — file missing');
  process.exit(0);
}
let src = readFileSync(file, 'utf8');
if (src.includes('SyncHealthBanner')) {
  console.log('✓ Dashboard already has SyncHealthBanner');
  process.exit(0);
}

if (!src.includes("from '@/app/actions/integrations'")) {
  console.log('skip dashboard health patch — unexpected source');
  process.exit(0);
}

src = src.replace(
  "from '@/app/actions/integrations';",
  "from '@/app/actions/integrations';\nimport { SyncHealthBanner } from '@/app/components/SyncHealthBanner';"
);

src = src.replace(
  '<div className="space-y-6">',
  '<div className="space-y-6">\n        <SyncHealthBanner />'
);

writeFileSync(file, src);
console.log('✓ Patched DashboardClient with SyncHealthBanner');
