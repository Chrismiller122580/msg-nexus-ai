#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function patch(rel, fn) {
  const file = join(root, rel);
  if (!existsSync(file)) return;
  const src = readFileSync(file, 'utf8');
  const next = fn(src);
  if (next !== src) {
    writeFileSync(file, next);
    console.log('✓ patched', rel);
  }
}

patch('lib/semantic-search.ts', (src) => {
  let out = src;
  if (!out.includes("from './smart-filters'")) {
    out = out.replace(
      "import { parseFromField, QUERY_VENDOR_ALIASES } from './ai-parser';",
      "import { parseFromField, QUERY_VENDOR_ALIASES } from './ai-parser';\nimport { categoryFromQuery } from './smart-filters';"
    );
  }
  if (!out.includes('categoryFromQuery(query)')) {
    out = out.replace(
      '  if (termHits > 0 && doc.insight) {\n    if (doc.insight.category !== \'other\') insightBoost += 0.08;',
      `  const wantCat = categoryFromQuery(query);
  if (wantCat && doc.insight?.category === wantCat) insightBoost += 0.35;
  if (termHits > 0 && doc.insight) {
    if (doc.insight.category !== 'other') insightBoost += 0.08;`
    );
  }
  if (!out.includes("'travel',")) {
    out = out.replace(
      "  'transport',",
      "  'transport',\n  'travel',"
    );
  }
  if (!out.includes('travel:')) {
    out = out.replace(
      "  transport: ['uber', 'lyft', 'doordash', 'uber eats', 'taxi'],",
      "  transport: ['uber', 'lyft', 'doordash', 'uber eats', 'taxi'],\n  travel: ['travel', 'flight', 'hotel', 'airbnb', 'airline', 'itinerary', 'avianca', 'boarding'],"
    );
  }
  return out;
});

patch('app/inbox/InboxClient.tsx', (src) => {
  let out = src;
  if (!out.includes('SmartFilterBar')) {
    if (out.includes("from '@/lib/utils'")) {
      out = out.replace(
        "from '@/lib/utils';",
        "from '@/lib/utils';\nimport { SmartFilterBar } from '@/app/inbox/SmartFilterBar';"
      );
    }
    out = out.replace(
      '<div className="flex flex-wrap gap-2">\n          {ALL_CATEGORIES.map((cat) => {',
      '<SmartFilterBar />\n        <div className="flex flex-wrap gap-2">\n          {ALL_CATEGORIES.map((cat) => {'
    );
  }
  out = out.replace(
    "const ALL_CATEGORIES: Category[] = ['subscription', 'bill', 'shopping', 'other'];",
    "const ALL_CATEGORIES: Category[] = ['subscription', 'bill', 'shopping', 'travel', 'other'];"
  );
  return out;
});

patch('app/components/UserShell.tsx', (src) =>
  src.replace(
    'placeholder="Search messages\u2026"',
    'placeholder="Bills, travel, Netflix\u2026"'
  )
);
