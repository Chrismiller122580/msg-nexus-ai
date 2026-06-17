import { Category, Insight } from './types';

// Simple but effective local "AI" parser for Phase 1.
// Deterministic, fast, no network. Extensible via dictionaries and rules.

const VENDORS: Array<{ name: string; aliases: string[] }> = [
  { name: 'Netflix', aliases: ['netflix', 'nflx'] },
  { name: 'Spotify', aliases: ['spotify', 'spot'] },
  { name: 'Amazon', aliases: ['amazon', 'amzn', 'prime'] },
  { name: 'Apple', aliases: ['apple', 'itunes', 'app store', 'icloud'] },
  { name: 'Google', aliases: ['google', 'youtube', 'yt premium', 'gcp'] },
  { name: 'Microsoft', aliases: ['microsoft', '365', 'xbox', 'office'] },
  { name: 'Adobe', aliases: ['adobe', 'creative cloud', 'acrobat'] },
  { name: 'Dropbox', aliases: ['dropbox'] },
  { name: 'Notion', aliases: ['notion'] },
  { name: 'GitHub', aliases: ['github', 'gh'] },
  { name: 'Electric Co', aliases: ['electric', 'power', 'utility', 'pge', 'con ed', 'duke energy'] },
  { name: 'Water Utility', aliases: ['water', 'sewer'] },
  { name: 'Internet Provider', aliases: ['comcast', 'xfinity', 'verizon', 'at&t', 'spectrum', 'internet'] },
  { name: 'Rent', aliases: ['rent', 'landlord', 'apartment'] },
  { name: 'Phone', aliases: ['verizon wireless', 't-mobile', 'at&t wireless', 'phone bill'] },
  { name: 'Uber', aliases: ['uber', 'uber eats'] },
  { name: 'DoorDash', aliases: ['doordash', 'dash'] },
  { name: 'Instacart', aliases: ['instacart'] },
  { name: 'Walmart', aliases: ['walmart'] },
  { name: 'Target', aliases: ['target'] },
  { name: 'Costco', aliases: ['costco'] },
];

const SUBSCRIPTION_KEYWORDS = [
  'subscription', 'sub', 'monthly', 'billed monthly', 'auto-renew', 'recurring',
  'membership', 'premium', 'plan', 'yearly', 'annual',
];

const BILL_KEYWORDS = [
  'bill', 'invoice', 'due', 'payment due', 'statement', 'balance', 'utility',
  'rent', 'mortgage', 'electric', 'water', 'gas', 'internet', 'phone',
];

const SHOPPING_KEYWORDS = [
  'order', 'shipped', 'purchase', 'bought', 'receipt', 'delivered', 'cart',
  'amazon', 'walmart', 'target', 'checkout', 'your order',
];

const AMOUNT_REGEX = /(?:USD|usd|\$|€|£)?\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\b/g;
const DATE_DUE_REGEX = /(?:due(?:\s+(?:on|by|date))?|pay by|payment due)\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9})/i;
const RECURRING_REGEX = /(every|monthly|yearly|annual|auto.?renew|recurring|billed monthly)/i;

function normalize(text: string): string {
  return text.toLowerCase();
}

function findVendor(text: string): string | undefined {
  const t = normalize(text);
  for (const v of VENDORS) {
    if (t.includes(v.name.toLowerCase())) return v.name;
    for (const alias of v.aliases) {
      if (t.includes(alias)) return v.name;
    }
  }
  return undefined;
}

function extractAmount(text: string): { amount?: number; currency: string } {
  const matches = Array.from(text.matchAll(AMOUNT_REGEX));
  if (!matches.length) return { currency: 'USD' };
  // Prefer the first plausible non-year amount
  for (const m of matches) {
    const raw = m[1].replace(/,/g, '');
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0.5 && val < 10000) {
      return { amount: Math.round(val * 100) / 100, currency: 'USD' };
    }
  }
  return { currency: 'USD' };
}

function extractDueDate(text: string): string | undefined {
  const m = text.match(DATE_DUE_REGEX);
  if (m && m[1]) {
    // Return pretty version of what we found
    return m[1].trim();
  }
  // Fallback: look for "15th" style or "on the 1st"
  const simple = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:of)?\s*(?:every|month)?/i);
  if (simple) return `on the ${simple[1]}${simple[1].endsWith('1') ? 'st' : simple[1].endsWith('2') ? 'nd' : simple[1].endsWith('3') ? 'rd' : 'th'}`;
  return undefined;
}

function classify(text: string, vendor?: string): Category {
  const t = normalize(text);

  const hasSub = SUBSCRIPTION_KEYWORDS.some((k) => t.includes(k));
  const hasBill = BILL_KEYWORDS.some((k) => t.includes(k));
  const hasShop = SHOPPING_KEYWORDS.some((k) => t.includes(k));

  // Priority order per plan
  if (hasSub) return 'subscription';
  if (hasBill) return 'bill';
  if (hasShop) return 'shopping';

  // Heuristic: recurring monthly language without explicit bill/sub
  if (RECURRING_REGEX.test(text)) return 'subscription';

  // Vendor based hints
  if (vendor) {
    const knownSubs = ['Netflix', 'Spotify', 'Adobe', 'Dropbox', 'Notion', 'GitHub', 'Microsoft', 'Google', 'Apple'];
    if (knownSubs.includes(vendor)) return 'subscription';
  }

  return 'other';
}

export function parseMessage(body: string, from?: string): Insight {
  const text = `${from || ''} ${body}`;
  const vendor = findVendor(text);
  const { amount, currency } = extractAmount(text);
  const dueDate = extractDueDate(text);
  const category = classify(text, vendor);
  const isRecurring = RECURRING_REGEX.test(text) || category === 'subscription';

  // Entities
  const entities: Insight['entities'] = [];
  if (vendor) entities.push({ type: 'vendor', value: vendor });
  if (amount != null) entities.push({ type: 'amount', value: `${currency || 'USD'} ${amount}` });
  if (dueDate) entities.push({ type: 'due', value: dueDate });

  // Build a human-ish summary
  let summary = '';
  if (category === 'subscription' && vendor && amount != null) {
    summary = `${vendor} subscription • ${formatMoney(amount)} recurring`;
  } else if (category === 'bill' && amount != null) {
    summary = `Bill for ${vendor || 'service'} • ${formatMoney(amount)}${dueDate ? ` due ${dueDate}` : ''}`;
  } else if (category === 'shopping' && amount != null) {
    summary = `Purchase${vendor ? ` from ${vendor}` : ''} • ${formatMoney(amount)}`;
  } else if (amount != null) {
    summary = `Detected ${formatMoney(amount)}${vendor ? ` at ${vendor}` : ''}`;
  } else {
    summary = 'No clear monetary signal detected.';
  }

  // Confidence: count signals
  let signals = 0;
  if (amount != null) signals++;
  if (vendor) signals++;
  if (dueDate) signals++;
  if (isRecurring) signals++;
  if (category !== 'other') signals++;
  const confidence = Math.min(0.95, 0.35 + signals * 0.12);

  return {
    messageId: '', // filled by caller
    category,
    amount,
    currency: currency || 'USD',
    vendor,
    dueDate,
    isRecurring,
    confidence: Math.round(confidence * 100) / 100,
    summary,
    entities,
  };
}

function formatMoney(n: number): string {
  return '$' + n.toFixed(2);
}

// Convenience for bulk
export function analyzeMessages(messages: Array<{ id: string; body: string; from?: string }>) {
  const out: Record<string, Insight> = {};
  for (const m of messages) {
    const ins = parseMessage(m.body, m.from);
    ins.messageId = m.id;
    out[m.id] = ins;
  }
  return out;
}
