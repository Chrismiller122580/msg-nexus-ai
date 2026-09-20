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

patch('lib/ai-parser.ts', (src) => {
  let out = src;
  if (!out.includes("from './travel'")) {
    out = out.replace(
      "import { extractAmountAndCurrency, formatCurrency as formatMoneyIntl } from './money';",
      "import { extractAmountAndCurrency, formatCurrency as formatMoneyIntl } from './money';\nimport { looksLikeTravel, TRAVEL_VENDORS } from './travel';"
    );
  }
  out = out.replace('export const PARSER_VERSION = 2;', 'export const PARSER_VERSION = 3;');
  if (!out.includes('...TRAVEL_VENDORS') && out.includes("name: 'Costco'")) {
    out = out.replace(
      "  { name: 'Costco', aliases: ['costco'] },\n];",
      "  { name: 'Costco', aliases: ['costco'] },\n  ...TRAVEL_VENDORS,\n];"
    );
  }
  if (!out.includes('looksLikeTravel(text, vendor)')) {
    out = out.replace(
      'function classify(text: string, vendor?: string): Category {\n  const hasStrongSub',
      'function classify(text: string, vendor?: string): Category {\n  if (looksLikeTravel(text, vendor)) return \'travel\';\n  const hasStrongSub'
    );
  }
  if (!out.includes("category === 'travel'")) {
    out = out.replace(
      "  } else if (category === 'shopping' && amount != null) {\n    summary = `Purchase${vendor ? ` from ${vendor}` : ''} • ${money}`;",
      "  } else if (category === 'travel' && amount != null) {\n    summary = `Travel${vendor ? ` • ${vendor}` : ''} • ${money} (not a bill)`;\n  } else if (category === 'shopping' && amount != null) {\n    summary = `Purchase${vendor ? ` from ${vendor}` : ''} • ${money}`;"
    );
  }
  out = out.replace(
    `  const isRecurring =
    category === 'subscription' ||
    RECURRING_REGEX.test(text) ||
    (KNOWN_SUB_VENDORS.has(vendor || '') && WEAK_MONTHLY_RE.test(text));`,
    `  const isRecurring =
    category !== 'travel' &&
    (category === 'subscription' ||
      RECURRING_REGEX.test(text) ||
      (KNOWN_SUB_VENDORS.has(vendor || '') && WEAK_MONTHLY_RE.test(text)));`
  );
  return out;
});

patch('lib/pulse-analytics.ts', (src) => {
  let out = src;
  out = out.replace(
    '  const isRecurringLike = insight.category === \'subscription\' || Boolean(insight.isRecurring);',
    "  const isRecurringLike = insight.category !== 'travel' && insight.category !== 'shopping' && (insight.category === 'subscription' || Boolean(insight.isRecurring));"
  );
  if (!out.includes("l.category === 'travel'")) {
    out = out.replace(
      "  const subChargeLines = spendLines.filter((l) => l.category === 'subscription');",
      "  const subChargeLines = spendLines.filter((l) => l.category === 'subscription');\n  const travelLines = spendLines.filter((l) => l.category === 'travel');"
    );
  }
  return out;
});

patch('lib/semantic-search.ts', (src) => {
  if (src.includes("ins.category === 'travel'")) return src;
  return src.replace(
    "    } else if (ins.category === 'shopping') {\n      shopping.push(item);\n    }",
    "    } else if (ins.category === 'shopping') {\n      shopping.push(item);\n    } else if (ins.category === 'travel') {\n      /* travel is spend, not a bill */\n    }"
  );
});

patch('app/actions/messages.ts', (src) =>
  src.replace(
    "const VALID_CATEGORIES = new Set<Category>(['bill', 'subscription', 'shopping', 'other']);",
    "const VALID_CATEGORIES = new Set<Category>(['bill', 'subscription', 'shopping', 'travel', 'other']);"
  )
);

patch('app/inbox/InboxClient.tsx', (src) =>
  src.replace(
    "const ALL_CATEGORIES: Category[] = ['subscription', 'bill', 'shopping', 'other'];",
    "const ALL_CATEGORIES: Category[] = ['subscription', 'bill', 'shopping', 'travel', 'other'];"
  )
);
