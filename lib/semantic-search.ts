import { Message, Insight, RankedMessage } from './types';

// Lightweight pure-JS semantic search for Phase 1.
// Uses a tiny hand-crafted concept embedding (no ML deps) + keyword boost.
// Works great for the narrow finance/messaging domain with < 200 msgs.

const CONCEPTS = [
  'money', 'bill', 'subscription', 'recurring', 'due_soon', 'vendor_media',
  'vendor_retail', 'vendor_utility', 'shopping', 'amazon', 'netflix_like',
  'rent', 'transport', 'date', 'urgent',
] as const;

type Concept = (typeof CONCEPTS)[number];

const CONCEPT_WORDS: Record<Concept, string[]> = {
  money: ['$', 'usd', 'dollars', 'paid', 'charge', 'cost', 'price', 'amount', 'total', 'bill', 'invoice'],
  bill: ['bill', 'invoice', 'statement', 'due', 'pay', 'balance', 'utility'],
  subscription: ['subscription', 'sub', 'monthly', 'recurring', 'premium', 'membership', 'plan', 'auto-renew', 'yearly'],
  recurring: ['recurring', 'every month', 'monthly', 'billed', 'auto', 'renew'],
  due_soon: ['due', 'tomorrow', 'soon', 'by the', '15th', '1st', 'due date'],
  vendor_media: ['netflix', 'spotify', 'youtube', 'disney', 'hulu', 'apple', 'prime'],
  vendor_retail: ['amazon', 'walmart', 'target', 'costco', 'order', 'shipped', 'delivered'],
  vendor_utility: ['electric', 'power', 'water', 'gas', 'internet', 'comcast', 'verizon', 'rent', 'landlord'],
  shopping: ['bought', 'purchase', 'order', 'cart', 'checkout', 'receipt', 'shop'],
  amazon: ['amazon', 'amzn'],
  netflix_like: ['netflix', 'spotify', 'adobe', 'dropbox', 'notion'],
  rent: ['rent', 'apartment', 'lease', 'housing'],
  transport: ['uber', 'lyft', 'doordash', 'uber eats', 'taxi'],
  date: ['date', 'due', 'on ', 'by ', '15', '30', '1st'],
  urgent: ['urgent', 'overdue', 'now', 'immediately', 'final', 'notice'],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s$]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function embed(text: string): number[] {
  const tokens = tokenize(text);
  const vec = new Array(CONCEPTS.length).fill(0);

  CONCEPTS.forEach((concept, idx) => {
    const words = CONCEPT_WORDS[concept] || [];
    let score = 0;
    for (const tok of tokens) {
      if (words.some((w) => tok.includes(w) || w.includes(tok))) {
        score += 1.0;
      }
    }
    // dampen
    vec[idx] = Math.tanh(score / 2.5);
  });

  // Light boost if amount-like pattern present
  if (/\$?\d+[\d,.]*/.test(text)) {
    const moneyIdx = CONCEPTS.indexOf('money');
    if (moneyIdx >= 0) vec[moneyIdx] = Math.max(vec[moneyIdx], 0.85);
  }

  return vec;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

function keywordBoost(query: string, msgText: string): number {
  const q = query.toLowerCase();
  const t = msgText.toLowerCase();
  let score = 0;
  const terms = q.split(/\s+/).filter((s) => s.length > 1);
  for (const term of terms) {
    if (t.includes(term)) score += 0.22;
    // small fuzzy-ish
    if (t.includes(term.slice(0, Math.max(3, term.length - 1)))) score += 0.08;
  }
  // Bonus for important finance terms
  if (q.includes('$') || q.includes('bill') || q.includes('sub')) score += 0.15;
  return Math.min(1.0, score);
}

export function embedQuery(query: string): number[] {
  return embed(query);
}

export function scoreRelevance(
  query: string,
  message: Message,
  insight?: Insight
): number {
  if (!query.trim()) return 0;

  const qvec = embedQuery(query);
  const mvec = embed(`${message.from} ${message.body} ${insight?.vendor || ''} ${insight?.summary || ''}`);

  const cos = cosine(qvec, mvec);

  const kw = keywordBoost(
    query,
    `${message.from} ${message.body} ${insight?.vendor || ''} ${insight?.category || ''}`
  );

  // Combine: semantic primary, keyword tie-breaker + insight boost
  let score = cos * 0.65 + kw * 0.35;

  if (insight) {
    if (insight.category !== 'other') score += 0.06;
    if (insight.amount != null) score += 0.05;
    if (insight.isRecurring) score += 0.04;
  }

  return Math.max(0, Math.min(1, score));
}

export function searchMessages(
  query: string,
  messages: Message[],
  insights: Record<string, Insight>
): RankedMessage[] {
  const q = query.trim();
  if (!q) {
    // No query: return all in recency order (caller can decide to sort)
    return messages.map((m) => ({
      message: m,
      score: 1,
      insight: insights[m.id],
    }));
  }

  const ranked: RankedMessage[] = messages.map((m) => {
    const ins = insights[m.id];
    return {
      message: m,
      score: scoreRelevance(q, m, ins),
      insight: ins,
    };
  });

  // Filter weak matches, then sort desc
  return ranked
    .filter((r) => r.score > 0.12)
    .sort((a, b) => b.score - a.score);
}

export function getTopInsights(messages: Message[], insights: Record<string, Insight>) {
  // Helper used by Pulse dashboard
  type InsightItem = { message: Message; insight: Insight };
  const subs: InsightItem[] = [];
  const bills: InsightItem[] = [];
  const shopping: InsightItem[] = [];

  let monthlyRecurring = 0;

  for (const m of messages) {
    const ins = insights[m.id];
    if (!ins || ins.category === 'other') continue;

    const item: InsightItem = {
      message: m,
      insight: ins,
    };

    if (ins.category === 'subscription') {
      subs.push(item);
      if (ins.amount && ins.isRecurring) monthlyRecurring += ins.amount;
    } else if (ins.category === 'bill') {
      bills.push(item);
    } else if (ins.category === 'shopping') {
      shopping.push(item);
    }
  }

  return { subs, bills, shopping, monthlyRecurring: Math.round(monthlyRecurring * 100) / 100 };
}
