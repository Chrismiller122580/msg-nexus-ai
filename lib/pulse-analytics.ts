/**
 * Pulse dashboard analytics — smarter totals for subscriptions, bills, shopping.
 * Multi-currency: amounts are summed per ISO code (no FX conversion).
 */

import type { Insight, Message, Category } from './types';
import {
  type BillingInterval,
  detectBillingInterval,
  formatCurrency,
  formatMoneyTotals,
  normalizeCurrencyCode,
  sumByCurrency,
  toMonthlyAmount,
} from './money';
import {
  buildSubscriptionCancelList,
  type SubscriptionCancelItem,
} from './subscription-cancel';
import { getTopInsights } from './semantic-search';

export type InsightItem = { message: Message; insight: Insight };

export type SpendLine = {
  messageId: string;
  vendor: string;
  category: Category;
  amount: number;
  /** Monthly-equivalent when recurring/subscription; else same as amount */
  monthlyAmount: number;
  currency: string;
  billingInterval: BillingInterval;
  timestamp: string;
  summary: string;
};

export type VendorRollup = {
  vendor: string;
  category: Category;
  currency: string;
  monthlyAmount: number;
  lastAmount: number;
  billingInterval: BillingInterval;
  count: number;
  messageId: string;
  lastTimestamp: string;
};

export type PulseAnalytics = {
  subscriptions: SubscriptionCancelItem[];
  upcomingBills: InsightItem[];
  shopping: InsightItem[];

  monthlyRecurringLabel: string;
  annualRunRateLabel: string;
  avgSubscriptionLabel: string;

  totalDetectedLabel: string;
  spentThisMonthLabel: string;
  spentLast30DaysLabel: string;

  shoppingSpendLabel: string;
  billsSpendLabel: string;
  subscriptionChargesLabel: string;
  upcomingBillsLabel: string;

  activeSubCount: number;
  billCount: number;
  shoppingCount: number;
  withAmountCount: number;
  parsedCount: number;
  messageCount: number;
  unparsedCount: number;

  categoryBreakdown: Array<{
    category: 'subscription' | 'bill' | 'shopping';
    label: string;
    totalLabel: string;
    count: number;
    sharePct: number;
  }>;

  topVendors: VendorRollup[];
  largestSubscription: SubscriptionCancelItem | null;
  recentCharges: SpendLine[];
  primaryCurrency: string;
};

function parseTs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function daysAgo(n: number, from = new Date()): Date {
  return new Date(from.getTime() - n * 24 * 60 * 60 * 1000);
}

function toSpendLine(message: Message, insight: Insight): SpendLine | null {
  if (insight.amount == null || !Number.isFinite(Number(insight.amount))) return null;
  const amount = Number(insight.amount);
  if (amount <= 0) return null;

  const textBlob = `${insight.summary || ''} ${message.body || ''} ${message.subject || ''}`;
  const isRecurringLike = insight.category === 'subscription' || Boolean(insight.isRecurring);
  const interval: BillingInterval = isRecurringLike
    ? detectBillingInterval(textBlob)
    : 'unknown';
  const currency = normalizeCurrencyCode(insight.currency);
  const monthlyAmount = isRecurringLike
    ? Math.round(toMonthlyAmount(amount, interval) * 100) / 100
    : amount;

  return {
    messageId: message.id,
    vendor: insight.vendor?.trim() || message.from || 'Unknown',
    category: insight.category,
    amount,
    monthlyAmount,
    currency,
    billingInterval: interval,
    timestamp: message.timestamp,
    summary: insight.summary || '',
  };
}

function moneyLabel(
  items: Array<{ amount?: number | null; currency?: string | null; monthly?: number | null }>
): string {
  return formatMoneyTotals(items);
}

/**
 * Build full Pulse dashboard model from the user's filtered messages + insights.
 */
export function buildPulseAnalytics(
  messages: Message[],
  insights: Record<string, Insight>,
  now = new Date()
): PulseAnalytics {
  const { subs, bills, shopping } = getTopInsights(messages, insights);
  const subscriptions = buildSubscriptionCancelList(subs);

  const upcomingBills = bills
    .filter((b) => b.insight.amount != null)
    .sort((a, b) => (b.insight.amount || 0) - (a.insight.amount || 0));

  const spendLines: SpendLine[] = [];
  for (const m of messages) {
    const ins = insights[m.id];
    if (!ins) continue;
    const line = toSpendLine(m, ins);
    if (line) spendLines.push(line);
  }

  const monthStart = startOfMonth(now).getTime();
  const last30 = daysAgo(30, now).getTime();

  const thisMonth = spendLines.filter((l) => parseTs(l.timestamp) >= monthStart);
  const last30Days = spendLines.filter((l) => parseTs(l.timestamp) >= last30);

  const shoppingLines = spendLines.filter((l) => l.category === 'shopping');
  const billLines = spendLines.filter((l) => l.category === 'bill');
  const subChargeLines = spendLines.filter((l) => l.category === 'subscription');

  const monthlyItems = subscriptions.map((c) => ({
    monthly: c.monthlyAmount,
    currency: c.currency,
  }));
  const annualItems = subscriptions.map((c) => ({
    monthly: c.monthlyAmount != null ? Math.round(c.monthlyAmount * 12 * 100) / 100 : undefined,
    currency: c.currency,
  }));

  const withMonthly = subscriptions.filter((s) => s.monthlyAmount != null && s.monthlyAmount > 0);
  const monthlySums = sumByCurrency(
    withMonthly.map((s) => ({ monthly: s.monthlyAmount, currency: s.currency }))
  );
  const primaryCurrency =
    monthlySums[0]?.currency ||
    sumByCurrency(spendLines.map((l) => ({ amount: l.amount, currency: l.currency })))[0]
      ?.currency ||
    'USD';

  const primaryMonthlySubs = withMonthly.filter(
    (s) => normalizeCurrencyCode(s.currency) === primaryCurrency
  );
  const avgSub =
    primaryMonthlySubs.length > 0
      ? primaryMonthlySubs.reduce((a, s) => a + (s.monthlyAmount || 0), 0) /
        primaryMonthlySubs.length
      : 0;

  const catDefs = [
    { category: 'subscription' as const, lines: subChargeLines, label: 'Subscriptions' },
    { category: 'bill' as const, lines: billLines, label: 'Bills' },
    { category: 'shopping' as const, lines: shoppingLines, label: 'Shopping' },
  ];
  const primaryTotals = catDefs.map((c) => ({
    ...c,
    sum: c.lines
      .filter((l) => l.currency === primaryCurrency)
      .reduce((a, l) => a + l.amount, 0),
  }));
  const primaryGrand = primaryTotals.reduce((a, c) => a + c.sum, 0) || 1;
  const categoryBreakdown = catDefs.map((c, i) => ({
    category: c.category,
    label: c.label,
    totalLabel: moneyLabel(c.lines.map((l) => ({ amount: l.amount, currency: l.currency }))),
    count: c.lines.length,
    sharePct: Math.round((primaryTotals[i].sum / primaryGrand) * 100),
  }));

  const vendorMap = new Map<string, VendorRollup>();
  for (const line of spendLines) {
    const key = `${line.category}::${line.vendor.toLowerCase()}`;
    const existing = vendorMap.get(key);
    if (!existing) {
      vendorMap.set(key, {
        vendor: line.vendor,
        category: line.category,
        currency: line.currency,
        monthlyAmount: line.monthlyAmount,
        lastAmount: line.amount,
        billingInterval: line.billingInterval,
        count: 1,
        messageId: line.messageId,
        lastTimestamp: line.timestamp,
      });
      continue;
    }
    existing.count += 1;
    const newer = parseTs(line.timestamp) >= parseTs(existing.lastTimestamp);
    if (line.monthlyAmount > existing.monthlyAmount || (newer && line.monthlyAmount === existing.monthlyAmount)) {
      existing.monthlyAmount = Math.max(existing.monthlyAmount, line.monthlyAmount);
      existing.lastAmount = line.amount;
      existing.currency = line.currency;
      existing.billingInterval = line.billingInterval;
      existing.messageId = line.messageId;
      existing.lastTimestamp = line.timestamp;
    } else if (newer) {
      existing.lastAmount = line.amount;
      existing.lastTimestamp = line.timestamp;
      existing.messageId = line.messageId;
    }
  }

  const topVendors = Array.from(vendorMap.values())
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount || b.lastAmount - a.lastAmount)
    .slice(0, 8);

  const largestSubscription =
    [...subscriptions]
      .filter((s) => s.monthlyAmount != null)
      .sort((a, b) => (b.monthlyAmount || 0) - (a.monthlyAmount || 0))[0] || null;

  const recentCharges = [...spendLines]
    .sort((a, b) => parseTs(b.timestamp) - parseTs(a.timestamp))
    .slice(0, 8);

  const parsedIds = new Set(Object.keys(insights));
  const parsedCount = messages.filter((m) => parsedIds.has(m.id)).length;

  return {
    subscriptions,
    upcomingBills,
    shopping,

    monthlyRecurringLabel: moneyLabel(monthlyItems),
    annualRunRateLabel: moneyLabel(annualItems),
    avgSubscriptionLabel:
      primaryMonthlySubs.length > 0
        ? formatCurrency(Math.round(avgSub * 100) / 100, primaryCurrency)
        : formatCurrency(0, primaryCurrency),

    totalDetectedLabel: moneyLabel(
      spendLines.map((l) => ({ amount: l.amount, currency: l.currency }))
    ),
    spentThisMonthLabel: moneyLabel(
      thisMonth.map((l) => ({ amount: l.amount, currency: l.currency }))
    ),
    spentLast30DaysLabel: moneyLabel(
      last30Days.map((l) => ({ amount: l.amount, currency: l.currency }))
    ),

    shoppingSpendLabel: moneyLabel(
      shoppingLines.map((l) => ({ amount: l.amount, currency: l.currency }))
    ),
    billsSpendLabel: moneyLabel(
      billLines.map((l) => ({ amount: l.amount, currency: l.currency }))
    ),
    subscriptionChargesLabel: moneyLabel(
      subChargeLines.map((l) => ({ amount: l.amount, currency: l.currency }))
    ),

    upcomingBillsLabel: moneyLabel(
      upcomingBills.map((b) => ({
        amount: b.insight.amount,
        currency: b.insight.currency,
      }))
    ),

    activeSubCount: subscriptions.length,
    billCount: upcomingBills.length,
    shoppingCount: shopping.length,
    withAmountCount: spendLines.length,
    parsedCount,
    messageCount: messages.length,
    unparsedCount: Math.max(0, messages.length - parsedCount),

    categoryBreakdown,
    topVendors,
    largestSubscription,
    recentCharges,
    primaryCurrency,
  };
}
