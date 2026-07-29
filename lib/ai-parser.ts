import { Category, Insight } from './types';
import { extractAmountAndCurrency, formatCurrency as formatMoneyIntl } from './money';

// Deterministic local parser for bills, subscriptions, shopping.
// Field-aware vendor matching + subject support.
// Bump when parse rules change so the UI can flag stale insights.
export const PARSER_VERSION = 2;

export const VENDORS: Array<{ name: string; aliases: string[] }> = [
  { name: 'Netflix', aliases: ['netflix', 'nflx'] },
  { name: 'Spotify', aliases: ['spotify'] },
  { name: 'Amazon', aliases: ['amazon', 'amzn'] },
  { name: 'Apple', aliases: ['apple', 'itunes', 'app store', 'icloud'] },
  { name: 'Google', aliases: ['google', 'youtube', 'yt premium', 'gcp'] },
  { name: 'Microsoft', aliases: ['microsoft', 'xbox', 'office 365', 'microsoft 365'] },
  { name: 'Adobe', aliases: ['adobe', 'creative cloud', 'acrobat'] },
  { name: 'Dropbox', aliases: ['dropbox'] },
  { name: 'Notion', aliases: ['notion'] },
  { name: 'GitHub', aliases: ['github', 'gh'] },
  { name: 'Electric Co', aliases: ['electric', 'pge', 'con ed', 'duke energy'] },
  { name: 'Water Utility', aliases: ['water utility', 'sewer'] },
  { name: 'Internet Provider', aliases: ['comcast', 'xfinity', 'verizon', 'at&t', 'spectrum'] },
  { name: 'Rent', aliases: ['landlord', 'apartment office'] },
  { name: 'Phone', aliases: ['verizon wireless', 't-mobile', 'at&t wireless', 'phone bill'] },
  { name: 'Uber', aliases: ['uber', 'uber eats'] },
  { name: 'DoorDash', aliases: ['doordash'] },
  { name: 'Instacart', aliases: ['instacart'] },
  { name: 'Walmart', aliases: ['walmart'] },
  { name: 'Target', aliases: ['target'] },
  { name: 'Costco', aliases: ['costco'] },
];

/** Query-side aliases for search recall (short → canonical brand token). */
export const QUERY_VENDOR_ALIASES: Record<string, string> = {
  gh: 'github',
  nflx: 'netflix',
  amzn: 'amazon',
  yt: 'youtube',
};

/** Strong SaaS / membership language (not bare "monthly" — that is common on utility bills). */
const STRONG_SUB_KEYWORDS = [
  'subscription',
  'billed monthly',
  'auto-renew',
  'auto renew',
  'recurring',
  'membership',
  'premium plan',
  'family plan',
  'plus plan',
  'pro plan',
  'yearly',
  'annual plan',
  'annual',
];

const BILL_KEYWORDS = [
  'bill',
  'invoice',
  'payment due',
  'statement',
  'utility',
  'mortgage',
  'amount due',
  'phone bill',
  'energy statement',
  'past due',
  'late fee',
];

const SHOPPING_KEYWORDS = [
  'shipped',
  'purchase',
  'bought',
  'delivered',
  'checkout',
  'your order',
];

const DATE_DUE_REGEX =
  /(?:due(?:\s+(?:on|by|date))?|pay by|payment due)\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9})/i;
const RECURRING_REGEX =
  /\b(every\s+month|auto[-\s]?renew|recurring|billed\s+monthly)\b/i;
/** Weaker recurring cue — only for known SaaS vendors, not utilities */
const WEAK_MONTHLY_RE = /\bmonthly\b|\b\/\s*mo\b|\bper\s+month\b/i;

const KNOWN_SUB_VENDORS = new Set([
  'Netflix',
  'Spotify',
  'Adobe',
  'Dropbox',
  'Notion',
  'GitHub',
  'Microsoft',
  'Google',
  'Apple',
  'Costco',
]);

/** Utilities / rent / phone → bills unless explicit membership/subscription SaaS language. */
const BILL_VENDORS = new Set([
  'Rent',
  'Electric Co',
  'Water Utility',
  'Internet Provider',
  'Phone',
]);

function normalize(text: string): string {
  return text.toLowerCase();
}

/** Escape a string for safe use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Token / word-boundary match. Short aliases (≤3 chars) never match as substrings
 * of longer words (e.g. "gh" must not match inside "night").
 */
export function textHasAlias(text: string, alias: string): boolean {
  const a = alias.trim().toLowerCase();
  if (!a) return false;
  const t = text.toLowerCase();

  // Multi-word phrase: require contiguous words
  if (a.includes(' ') || a.includes('&')) {
    const parts = a.split(/\s+/).map(escapeRe).join('\\s+');
    return new RegExp(`(?:^|[^a-z0-9])${parts}(?:[^a-z0-9]|$)`, 'i').test(t);
  }

  if (a.length <= 3) {
    // Whole token only, or email local/domain label
    return new RegExp(`(?:^|[^a-z0-9])${escapeRe(a)}(?:[^a-z0-9]|$)`, 'i').test(t);
  }

  // Longer aliases: word-boundary-ish (allow inside email domains like github.com)
  return new RegExp(`(?:^|[^a-z0-9])${escapeRe(a)}(?:[^a-z0-9]|$)`, 'i').test(t);
}

export type ParsedFrom = {
  display: string;
  email?: string;
  local?: string;
  domain?: string;
  raw: string;
};

/** Parse `Name <user@domain.com>` or bare email / display name. */
export function parseFromField(from?: string): ParsedFrom {
  const raw = (from || '').trim();
  if (!raw) return { display: '', raw: '' };

  const angle = raw.match(/^\s*(.*?)\s*<\s*([^>]+@[^>]+)\s*>\s*$/);
  if (angle) {
    const email = angle[2].trim().toLowerCase();
    const [local, domain] = email.split('@');
    return {
      display: (angle[1] || local || '').trim() || email,
      email,
      local,
      domain,
      raw,
    };
  }

  if (/^[^\s<>]+@[^\s<>]+$/.test(raw)) {
    const email = raw.toLowerCase();
    const [local, domain] = email.split('@');
    return { display: local || email, email, local, domain, raw };
  }

  return { display: raw, raw };
}

type VendorHit = { name: string; score: number; aliasLen: number };

function scoreVendorInField(
  field: string,
  fieldWeight: number,
  hits: Map<string, VendorHit>
): void {
  if (!field.trim()) return;
  for (const v of VENDORS) {
    const candidates = [v.name, ...v.aliases];
    for (const alias of candidates) {
      if (!textHasAlias(field, alias)) continue;
      const score = fieldWeight + Math.min(alias.length, 12) * 0.05;
      const prev = hits.get(v.name);
      if (!prev || score > prev.score || (score === prev.score && alias.length > prev.aliasLen)) {
        hits.set(v.name, { name: v.name, score, aliasLen: alias.length });
      }
    }
  }
}

/**
 * Find vendor with field priority: from/email/domain > subject > body.
 * Prefer longest / highest-scoring match.
 */
export function findVendor(opts: {
  from?: string;
  subject?: string;
  body?: string;
}): string | undefined {
  const parsed = parseFromField(opts.from);
  const hits = new Map<string, VendorHit>();

  // from display + email parts (highest)
  scoreVendorInField(parsed.display, 12, hits);
  if (parsed.email) scoreVendorInField(parsed.email, 14, hits);
  if (parsed.domain) scoreVendorInField(parsed.domain, 15, hits);
  if (parsed.local) scoreVendorInField(parsed.local, 13, hits);
  scoreVendorInField(opts.subject || '', 10, hits);
  scoreVendorInField(opts.body || '', 6, hits);

  let best: VendorHit | undefined;
  for (const h of hits.values()) {
    if (!best || h.score > best.score || (h.score === best.score && h.aliasLen > best.aliasLen)) {
      best = h;
    }
  }
  return best?.name;
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const t = normalize(text);
  return keywords.some((k) => {
    if (k.includes(' ')) return t.includes(k);
    return textHasAlias(t, k);
  });
}

function extractDueDate(text: string): string | undefined {
  const m = text.match(DATE_DUE_REGEX);
  if (m && m[1]) return m[1].trim();

  // Explicit ordinal day only with due/pay context already handled above.
  // Fallback: "on the 1st" / "by the 15th" — require the word "the" to avoid $41.75 → 41st.
  const simple = text.match(
    /\b(?:on|by|before)\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
  );
  if (simple) {
    const n = simple[1];
    const suf =
      n.endsWith('1') && n !== '11'
        ? 'st'
        : n.endsWith('2') && n !== '12'
          ? 'nd'
          : n.endsWith('3') && n !== '13'
            ? 'rd'
            : 'th';
    return `on the ${n}${suf}`;
  }
  return undefined;
}

function classify(text: string, vendor?: string): Category {
  const hasStrongSub = hasKeyword(text, STRONG_SUB_KEYWORDS);
  const hasBill = hasKeyword(text, BILL_KEYWORDS);
  const hasShop = hasKeyword(text, SHOPPING_KEYWORDS);
  const isBillVendor = vendor != null && BILL_VENDORS.has(vendor);
  const isSubVendor = vendor != null && KNOWN_SUB_VENDORS.has(vendor);

  // Explicit shopping first (orders / shipping)
  if (hasShop || /\byour order\b|\border\s+#/i.test(text)) return 'shopping';

  // Phone / utility / rent: prefer bill. Bare "monthly" must not force subscription.
  if (isBillVendor) {
    if (hasStrongSub && !hasBill) return 'subscription';
    return 'bill';
  }

  if (hasStrongSub) return 'subscription';
  if (hasBill) return 'bill';

  if (RECURRING_REGEX.test(text)) return 'subscription';

  // Known SaaS / membership brands default to subscription (even soft "monthly")
  if (isSubVendor) {
    if (WEAK_MONTHLY_RE.test(text) || hasStrongSub || RECURRING_REGEX.test(text)) {
      return 'subscription';
    }
    return 'subscription';
  }

  // Weak monthly language alone is not enough without a known sub vendor
  return 'other';
}

/** True when insight is missing or was produced by an older parser. */
export function isInsightStale(insight?: Insight | null): boolean {
  if (!insight) return false;
  return insight.parserVersion !== PARSER_VERSION;
}

export function isInsightCurrent(insight?: Insight | null): boolean {
  return !!insight && insight.parserVersion === PARSER_VERSION;
}

export function countAnalysisGaps(
  messages: Array<{ id: string }>,
  insights: Record<string, Insight>
): { unparsed: number; stale: number; current: number } {
  let unparsed = 0;
  let stale = 0;
  let current = 0;
  for (const m of messages) {
    const ins = insights[m.id];
    if (!ins) unparsed++;
    else if (isInsightStale(ins)) stale++;
    else current++;
  }
  return { unparsed, stale, current };
}

export function parseMessage(body: string, from?: string, subject?: string): Insight {
  const text = [from, subject, body].filter(Boolean).join(' ');
  const vendor = findVendor({ from, subject, body });
  const { amount, currency } = extractAmountAndCurrency(text, {
    vendorHint: vendor,
  });
  const dueDate = extractDueDate(text);
  const category = classify(text, vendor);
  const isRecurring =
    category === 'subscription' ||
    RECURRING_REGEX.test(text) ||
    (KNOWN_SUB_VENDORS.has(vendor || '') && WEAK_MONTHLY_RE.test(text));

  const entities: Insight['entities'] = [];
  if (vendor) entities.push({ type: 'vendor', value: vendor });
  if (amount != null) entities.push({ type: 'amount', value: `${currency || 'USD'} ${amount}` });
  if (dueDate) entities.push({ type: 'due', value: dueDate });

  const money = amount != null ? formatMoneyIntl(amount, currency) : '';

  let summary = '';
  if (category === 'subscription' && vendor && amount != null) {
    summary = `${vendor} subscription • ${money} recurring`;
  } else if (category === 'bill' && amount != null) {
    summary = `Bill for ${vendor || 'service'} • ${money}${dueDate ? ` due ${dueDate}` : ''}`;
  } else if (category === 'shopping' && amount != null) {
    summary = `Purchase${vendor ? ` from ${vendor}` : ''} • ${money}`;
  } else if (amount != null) {
    summary = `Detected ${money}${vendor ? ` at ${vendor}` : ''}`;
  } else {
    summary = 'No clear monetary signal detected.';
  }

  let signals = 0;
  if (amount != null) signals++;
  if (vendor) signals++;
  if (dueDate) signals++;
  if (isRecurring) signals++;
  if (category !== 'other') signals++;
  const confidence = Math.min(0.95, 0.35 + signals * 0.12);

  return {
    messageId: '',
    category,
    amount,
    currency: currency || 'USD',
    vendor,
    dueDate,
    isRecurring,
    confidence: Math.round(confidence * 100) / 100,
    summary,
    entities,
    parserVersion: PARSER_VERSION,
  };
}

export function analyzeMessages(
  messages: Array<{ id: string; body: string; from?: string; subject?: string }>
) {
  const out: Record<string, Insight> = {};
  for (const m of messages) {
    const ins = parseMessage(m.body, m.from, m.subject);
    ins.messageId = m.id;
    out[m.id] = ins;
  }
  return out;
}
