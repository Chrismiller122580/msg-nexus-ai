import type { Category } from './types';

export const SMART_PRESETS: Array<{
  id: string;
  label: string;
  query: string;
  category?: Category;
}> = [
  { id: 'all', label: 'All', query: '' },
  { id: 'bills', label: 'Bills', query: 'bills', category: 'bill' },
  { id: 'subs', label: 'Subscriptions', query: 'subscription', category: 'subscription' },
  { id: 'travel', label: 'Travel', query: 'travel', category: 'travel' },
  { id: 'shopping', label: 'Shopping', query: 'order', category: 'shopping' },
];

const QUERY_TO_CATEGORY: Array<{ re: RegExp; category: Category }> = [
  { re: /\b(travel|trip|flight|flights|hotel|hotels|airline|airbnb|itinerary|boarding)\b/i, category: 'travel' },
  { re: /\b(subscription|subscriptions|subs|membership|netflix|spotify)\b/i, category: 'subscription' },
  { re: /\b(bills?|invoice|utility|utilities|rent)\b/i, category: 'bill' },
  { re: /\b(shopping|order|orders|shipped|amazon)\b/i, category: 'shopping' },
];

export function categoryFromQuery(query: string): Category | null {
  const q = query.trim();
  if (!q) return null;
  for (const row of QUERY_TO_CATEGORY) {
    if (row.re.test(q)) return row.category;
  }
  return null;
}
