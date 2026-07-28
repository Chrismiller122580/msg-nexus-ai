/** Currency + billing-period helpers for Pulse / Active Subscriptions. */

const SYMBOL_TO_CODE: Record<string, string> = {
  $: 'USD',
  'US$': 'USD',
  USD: 'USD',
  '€': 'EUR',
  EUR: 'EUR',
  '£': 'GBP',
  GBP: 'GBP',
  '¥': 'JPY',
  JPY: 'JPY',
  CAD: 'CAD',
  'CA$': 'CAD',
  C$: 'CAD',
  AUD: 'AUD',
  'A$': 'AUD',
  MXN: 'MXN',
  INR: 'INR',
  '₹': 'INR',
};

export type BillingInterval = 'month' | 'year' | 'week' | 'unknown';

/** Normalize free-text / symbols into a valid ISO 4217 code for Intl. */
export function normalizeCurrencyCode(code?: string | null): string {
  if (code == null || String(code).trim() === '') return 'USD';
  const raw = String(code).trim();
  const upper = raw.toUpperCase();
  if (SYMBOL_TO_CODE[raw]) return SYMBOL_TO_CODE[raw];
  if (SYMBOL_TO_CODE[upper]) return SYMBOL_TO_CODE[upper];
  // Strip trailing punctuation / lower-case iso
  const compact = upper.replace(/[^A-Z]/g, '');
  if (compact.length === 3 && SYMBOL_TO_CODE[compact]) return SYMBOL_TO_CODE[compact];
  if (/^[A-Z]{3}$/.test(compact)) return compact;
  return 'USD';
}

export function formatCurrency(amount?: number | null, currency: string = 'USD'): string {
  if (amount == null) return '';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '';
  const code = normalizeCurrencyCode(currency);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: code === 'JPY' ? 0 : 2,
      maximumFractionDigits: code === 'JPY' ? 0 : 2,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

/** Detect billing period from message/summary text. */
export function detectBillingInterval(text: string): BillingInterval {
  const t = text.toLowerCase();
  if (
    /\/\s*yr\b|per\s*year|\/year\b|yearly|annual|\/\s*annum|for the year|billed annually|\/\s*ann\b/.test(
      t
    )
  ) {
    return 'year';
  }
  if (/\/\s*wk\b|per\s*week|weekly|\/week\b/.test(t)) return 'week';
  if (
    /\/\s*mo\b|per\s*month|monthly|\/month\b|billed monthly|each month|every month/.test(t)
  ) {
    return 'month';
  }
  return 'unknown';
}

/** Convert a charged amount into an approximate monthly figure for totals. */
export function toMonthlyAmount(amount: number, interval: BillingInterval): number {
  if (!Number.isFinite(amount)) return 0;
  if (interval === 'year') return amount / 12;
  if (interval === 'week') return (amount * 52) / 12;
  return amount; // month or unknown → treat as monthly for subscription totals
}

export function intervalSuffix(interval: BillingInterval): string {
  if (interval === 'year') return '/yr';
  if (interval === 'week') return '/wk';
  if (interval === 'month') return '/mo';
  return ''; // unknown — don't invent a period
}

/**
 * Parse amount + currency from free text.
 * Prefers explicit currency symbols/codes near the number.
 */
export function extractAmountAndCurrency(text: string): {
  amount?: number;
  currency: string;
} {
  // Codes / multi-char symbols first so "CAD $14.99" is CAD not USD.
  // Groups: preCode, preSym, amount, postCode
  const re =
    /(?:\b(USD|EUR|GBP|CAD|AUD|MXN|INR|US\$|CA\$|C\$|A\$)\b\s*)?(?:([€£¥₹$]))?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:\b(USD|EUR|GBP|CAD|AUD|MXN|INR)\b)?/gi;

  let best: { amount: number; currency: string; score: number } | null = null;

  for (const m of text.matchAll(re)) {
    const raw = m[3]?.replace(/,/g, '');
    if (!raw) continue;
    const val = parseFloat(raw);
    if (!Number.isFinite(val) || val <= 0.5 || val >= 100_000) continue;

    const preCode = m[1];
    const preSym = m[2];
    const postCode = m[4];
    const hasCurrency = Boolean(preCode || preSym || postCode);
    // Skip 4-digit years when no currency signal
    if (!hasCurrency && val >= 1900 && val <= 2100 && !raw.includes('.')) continue;

    // Prefer ISO code over $ so "CAD $14.99" → CAD
    let currency = 'USD';
    if (preCode) currency = normalizeCurrencyCode(preCode);
    else if (postCode) currency = normalizeCurrencyCode(postCode);
    else if (preSym) currency = normalizeCurrencyCode(preSym);

    let score = 1;
    if (preCode || postCode) score += 5;
    else if (preSym) score += 3;
    if (raw.includes('.')) score += 2;
    if (val < 500) score += 1;

    if (!best || score > best.score) {
      best = { amount: Math.round(val * 100) / 100, currency, score };
    }
  }

  if (!best) return { currency: 'USD' };
  return { amount: best.amount, currency: best.currency };
}

/** Sum amounts per currency (no FX conversion). */
export function sumByCurrency(
  items: Array<{ amount?: number | null; currency?: string | null; monthly?: number | null }>
): Array<{ currency: string; total: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const n =
      item.monthly != null
        ? Number(item.monthly)
        : item.amount != null
          ? Number(item.amount)
          : NaN;
    if (!Number.isFinite(n) || n === 0) continue;
    const code = normalizeCurrencyCode(item.currency);
    map.set(code, Math.round(((map.get(code) || 0) + n) * 100) / 100);
  }
  return Array.from(map.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

/** Format multi-currency totals for Pulse cards. */
export function formatMoneyTotals(
  items: Array<{ amount?: number | null; currency?: string | null; monthly?: number | null }>
): string {
  const sums = sumByCurrency(items);
  if (sums.length === 0) return formatCurrency(0, 'USD');
  return sums.map((s) => formatCurrency(s.total, s.currency)).join(' + ');
}
