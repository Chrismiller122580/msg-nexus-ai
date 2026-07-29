import { Message, Insight, RankedMessage } from './types';
import { parseFromField, QUERY_VENDOR_ALIASES } from './ai-parser';

// Hybrid search: inverted-index recall + field-weighted rank.
// Index is built once per message set; queries only score candidates.

const CONCEPTS = [
  'money',
  'bill',
  'subscription',
  'recurring',
  'due_soon',
  'vendor_media',
  'vendor_retail',
  'vendor_utility',
  'shopping',
  'amazon',
  'netflix_like',
  'rent',
  'transport',
  'date',
  'urgent',
] as const;

type Concept = (typeof CONCEPTS)[number];

const CONCEPT_WORDS: Record<Concept, string[]> = {
  money: ['$', 'usd', 'dollars', 'paid', 'charge', 'cost', 'price', 'amount', 'total', 'bill', 'invoice'],
  bill: ['bill', 'invoice', 'statement', 'due', 'pay', 'balance', 'utility'],
  subscription: [
    'subscription',
    'monthly',
    'recurring',
    'premium',
    'membership',
    'plan',
    'auto-renew',
    'yearly',
  ],
  recurring: ['recurring', 'every month', 'monthly', 'billed', 'auto', 'renew'],
  due_soon: ['due', 'tomorrow', 'soon', 'by the', '15th', '1st', 'due date'],
  vendor_media: ['netflix', 'spotify', 'youtube', 'disney', 'hulu', 'apple', 'prime'],
  vendor_retail: ['amazon', 'walmart', 'target', 'costco', 'order', 'shipped', 'delivered'],
  vendor_utility: ['electric', 'power', 'water', 'gas', 'internet', 'comcast', 'verizon', 'rent', 'landlord'],
  shopping: ['bought', 'purchase', 'order', 'cart', 'checkout', 'receipt', 'shop'],
  amazon: ['amazon', 'amzn'],
  netflix_like: ['netflix', 'spotify', 'adobe', 'dropbox', 'notion', 'github'],
  rent: ['rent', 'apartment', 'lease', 'housing'],
  transport: ['uber', 'lyft', 'doordash', 'uber eats', 'taxi'],
  date: ['date', 'due', 'on ', 'by ', '15', '30', '1st'],
  urgent: ['urgent', 'overdue', 'now', 'immediately', 'final', 'notice'],
};

/** Field weights for ranking (relative). */
const FIELD_WEIGHT = {
  subject: 4.5,
  fromDisplay: 4.0,
  fromEmail: 4.2,
  fromDomain: 5.0,
  vendor: 3.5,
  summary: 1.2,
  body: 1.8,
  category: 1.0,
} as const;

type FieldName = keyof typeof FIELD_WEIGHT;

const BODY_INDEX_MAX = 4000;

export type SearchDoc = {
  id: string;
  message: Message;
  insight?: Insight;
  fields: Record<FieldName, string>;
  /** term → field → tf */
  termFields: Map<string, Partial<Record<FieldName, number>>>;
  conceptVec: number[];
};

export type SearchIndex = {
  docs: SearchDoc[];
  byId: Map<string, SearchDoc>;
  /** term → set of doc ids (recall) */
  inverted: Map<string, Set<string>>;
  /** term → document frequency */
  df: Map<string, number>;
  nDocs: number;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/([a-z0-9])@([a-z0-9.-]+)/g, ' $1 $2 $1@$2 ') // email parts
    .replace(/[^a-z0-9@.\s$]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 || t === '$');
}

function embed(text: string): number[] {
  const tokens = tokenize(text);
  const vec = new Array(CONCEPTS.length).fill(0);

  CONCEPTS.forEach((concept, idx) => {
    const words = CONCEPT_WORDS[concept] || [];
    let score = 0;
    for (const tok of tokens) {
      for (const w of words) {
        if (tok === w || (w.length > 3 && (tok.includes(w) || w.includes(tok)))) {
          score += 1.0;
          break;
        }
      }
    }
    vec[idx] = Math.tanh(score / 2.5);
  });

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

function addTerms(
  termFields: Map<string, Partial<Record<FieldName, number>>>,
  field: FieldName,
  text: string
) {
  for (const term of tokenize(text)) {
    let entry = termFields.get(term);
    if (!entry) {
      entry = {};
      termFields.set(term, entry);
    }
    entry[field] = (entry[field] || 0) + 1;
  }
}

export function buildSearchIndex(
  messages: Message[],
  insights: Record<string, Insight>
): SearchIndex {
  const docs: SearchDoc[] = [];
  const byId = new Map<string, SearchDoc>();
  const inverted = new Map<string, Set<string>>();
  const df = new Map<string, number>();

  for (const message of messages) {
    const insight = insights[message.id];
    const from = parseFromField(message.from);
    const body = (message.body || '').slice(0, BODY_INDEX_MAX);

    const fields: Record<FieldName, string> = {
      subject: message.subject || '',
      fromDisplay: from.display || message.from || '',
      fromEmail: from.email || '',
      fromDomain: from.domain || '',
      vendor: insight?.vendor || '',
      summary: insight?.summary || '',
      body,
      category: insight?.category || '',
    };

    const termFields = new Map<string, Partial<Record<FieldName, number>>>();
    (Object.keys(fields) as FieldName[]).forEach((f) => addTerms(termFields, f, fields[f]));

    // Domain root token: github.com → also index "github"
    if (from.domain) {
      const root = from.domain.split('.')[0];
      if (root && root.length > 2) {
        let entry = termFields.get(root);
        if (!entry) {
          entry = {};
          termFields.set(root, entry);
        }
        entry.fromDomain = (entry.fromDomain || 0) + 1;
      }
    }

    const conceptText = [
      fields.fromDisplay,
      fields.subject,
      fields.body,
      fields.vendor,
      fields.summary,
    ].join(' ');

    const doc: SearchDoc = {
      id: message.id,
      message,
      insight,
      fields,
      termFields,
      conceptVec: embed(conceptText),
    };
    docs.push(doc);
    byId.set(doc.id, doc);

    for (const term of termFields.keys()) {
      let set = inverted.get(term);
      if (!set) {
        set = new Set();
        inverted.set(term, set);
      }
      set.add(doc.id);
    }
  }

  for (const [term, set] of inverted) {
    df.set(term, set.size);
  }

  return { docs, byId, inverted, df, nDocs: docs.length };
}

function expandQueryTerms(rawTerms: string[]): string[] {
  const out = new Set<string>();
  for (const t of rawTerms) {
    out.add(t);
    const alias = QUERY_VENDOR_ALIASES[t];
    if (alias) out.add(alias);
    // brand → domain form
    if (t.length > 2) out.add(`${t}.com`);
  }
  return [...out];
}

function idf(index: SearchIndex, term: string): number {
  const n = index.nDocs || 1;
  const d = index.df.get(term) || 0;
  // smooth IDF
  return Math.log(1 + (n - d + 0.5) / (d + 0.5));
}

function fieldTf(doc: SearchDoc, term: string, field: FieldName): number {
  return doc.termFields.get(term)?.[field] || 0;
}

function scoreDoc(
  query: string,
  queryTerms: string[],
  expanded: string[],
  doc: SearchDoc,
  index: SearchIndex,
  qvec: number[],
  keywordMode: boolean
): { score: number; termHits: number } {
  let fieldScore = 0;
  let termHits = 0;
  const covered = new Set<string>();

  for (const term of expanded) {
    if (!doc.termFields.has(term)) continue;
    termHits++;
    // Map expanded hits back to original query coverage
    for (const qt of queryTerms) {
      if (qt === term || QUERY_VENDOR_ALIASES[qt] === term || term === `${qt}.com`) {
        covered.add(qt);
      }
    }

    const w = idf(index, term);
    for (const field of Object.keys(FIELD_WEIGHT) as FieldName[]) {
      const tf = fieldTf(doc, term, field);
      if (tf <= 0) continue;
      // BM25-ish saturation
      const tfNorm = tf / (1 + tf);
      fieldScore += tfNorm * FIELD_WEIGHT[field] * w;
    }
  }

  // Full query phrase in subject / from
  const qLower = query.toLowerCase().trim();
  if (qLower.length > 2) {
    if (doc.fields.subject.toLowerCase().includes(qLower)) fieldScore += 6;
    if (doc.fields.fromDisplay.toLowerCase().includes(qLower)) fieldScore += 5;
    if (doc.fields.fromEmail.toLowerCase().includes(qLower)) fieldScore += 5;
    if (doc.fields.fromDomain.toLowerCase().includes(qLower)) fieldScore += 7;
    if (doc.fields.vendor.toLowerCase() === qLower) fieldScore += 5;
    else if (doc.fields.vendor.toLowerCase().includes(qLower)) fieldScore += 3;
  }

  // Coverage bonus
  if (queryTerms.length > 0) {
    fieldScore += (covered.size / queryTerms.length) * 2.5;
  }

  // Concept assist (capped) — never alone for keyword mode
  let concept = 0;
  if (!keywordMode || termHits > 0) {
    concept = cosine(qvec, doc.conceptVec) * (keywordMode ? 0.15 : 0.35);
  }

  // Insight boost only with real term overlap
  let insightBoost = 0;
  if (termHits > 0 && doc.insight) {
    if (doc.insight.category !== 'other') insightBoost += 0.08;
    if (doc.insight.amount != null) insightBoost += 0.05;
    if (doc.insight.isRecurring) insightBoost += 0.04;
  }

  // Soft recency (0..0.15)
  const ageMs = Date.now() - new Date(doc.message.timestamp).getTime();
  const recency = Number.isFinite(ageMs)
    ? Math.max(0, 0.15 * Math.exp(-Math.max(0, ageMs) / (1000 * 60 * 60 * 24 * 30)))
    : 0;

  // Normalize fieldScore roughly into 0..1-ish then blend
  const fieldNorm = Math.tanh(fieldScore / 8);
  const score = Math.max(0, Math.min(1, fieldNorm * 0.78 + concept * 0.12 + insightBoost + recency * 0.05));

  return { score, termHits };
}

/**
 * Recall candidates via inverted index, then field-weighted rank.
 * Exposes candidate count for tests/diagnostics via optional out param.
 */
export function searchWithIndex(
  query: string,
  index: SearchIndex,
  opts?: { maxCandidates?: number; debug?: { candidateCount?: number } }
): RankedMessage[] {
  const q = query.trim();
  if (!q) {
    return index.docs.map((d) => ({
      message: d.message,
      score: 1,
      insight: d.insight,
    }));
  }

  const rawTerms = tokenize(q).filter((t) => t.length > 1);
  const expanded = expandQueryTerms(rawTerms);
  const keywordMode = rawTerms.length <= 2 && rawTerms.every((t) => t.length < 24);

  // --- RECALL ---
  const candidateIds = new Set<string>();
  for (const term of expanded) {
    const postings = index.inverted.get(term);
    if (postings) {
      for (const id of postings) candidateIds.add(id);
    }
  }

  // NL soft expand: pull concept word list terms that appear in query into extra recall
  if (!keywordMode || rawTerms.length >= 2) {
    for (const concept of CONCEPTS) {
      const words = CONCEPT_WORDS[concept];
      if (words.some((w) => q.toLowerCase().includes(w))) {
        for (const w of words) {
          const tok = tokenize(w)[0];
          if (!tok) continue;
          const postings = index.inverted.get(tok);
          if (postings && postings.size < index.nDocs * 0.4) {
            for (const id of postings) candidateIds.add(id);
          }
        }
      }
    }
  }

  if (opts?.debug) opts.debug.candidateCount = candidateIds.size;

  const qvec = embed(q);
  const maxCand = opts?.maxCandidates ?? 500;

  // Prefer rarer-term postings first if we need to cap
  let candidates: SearchDoc[];
  if (candidateIds.size === 0) {
    // No inverted hits — for multi-term NL, fall back to scoring a recency window
    if (!keywordMode) {
      candidates = [...index.docs]
        .sort(
          (a, b) =>
            new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime()
        )
        .slice(0, Math.min(80, index.nDocs));
    } else {
      return [];
    }
  } else if (candidateIds.size > maxCand) {
    // Keep docs that hit the rarest query term first
    const rankedTerms = [...expanded].sort((a, b) => (index.df.get(a) || 0) - (index.df.get(b) || 0));
    const picked = new Set<string>();
    for (const term of rankedTerms) {
      const postings = index.inverted.get(term);
      if (!postings) continue;
      for (const id of postings) {
        picked.add(id);
        if (picked.size >= maxCand) break;
      }
      if (picked.size >= maxCand) break;
    }
    candidates = [...picked].map((id) => index.byId.get(id)!).filter(Boolean);
  } else {
    candidates = [...candidateIds].map((id) => index.byId.get(id)!).filter(Boolean);
  }

  // --- RANK ---
  const ranked: RankedMessage[] = [];
  for (const doc of candidates) {
    const { score, termHits } = scoreDoc(q, rawTerms, expanded, doc, index, qvec, keywordMode);
    if (keywordMode && termHits === 0) continue;
    if (score < 0.08) continue;
    ranked.push({ message: doc.message, score, insight: doc.insight });
  }

  ranked.sort((a, b) => b.score - a.score || b.message.timestamp.localeCompare(a.message.timestamp));
  return ranked;
}

/** Convenience: build index + search (stable API for call sites / tests). */
export function searchMessages(
  query: string,
  messages: Message[],
  insights: Record<string, Insight>
): RankedMessage[] {
  const index = buildSearchIndex(messages, insights);
  return searchWithIndex(query, index);
}

export function scoreRelevance(
  query: string,
  message: Message,
  insight?: Insight
): number {
  const insights: Record<string, Insight> = insight ? { [message.id]: insight } : {};
  const results = searchMessages(query, [message], insights);
  return results[0]?.score ?? 0;
}

export function embedQuery(query: string): number[] {
  return embed(query);
}

export function getTopInsights(messages: Message[], insights: Record<string, Insight>) {
  type InsightItem = { message: Message; insight: Insight };
  const subs: InsightItem[] = [];
  const bills: InsightItem[] = [];
  const shopping: InsightItem[] = [];

  for (const m of messages) {
    const ins = insights[m.id];
    if (!ins || ins.category === 'other') continue;

    const item: InsightItem = { message: m, insight: ins };

    if (ins.category === 'subscription') {
      subs.push(item);
    } else if (ins.category === 'bill') {
      bills.push(item);
    } else if (ins.category === 'shopping') {
      shopping.push(item);
    }
  }

  return { subs, bills, shopping, monthlyRecurring: 0 };
}
