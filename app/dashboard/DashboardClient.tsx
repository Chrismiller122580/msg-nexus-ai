'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  DollarSign,
  Loader2,
  Mail,
  MessageSquare,
  PenSquare,
  Plug,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserShell } from '@/app/components/UserShell';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';
import { getCurrentUserAction } from '@/app/actions/user';
import { getUserMessages, saveInsight } from '@/app/actions/messages';
import { getConnectedAccounts } from '@/app/actions/onboarding';
import { getGmailStatus } from '@/app/actions/gmail';
import { getOutlookStatus } from '@/app/actions/outlook';
import { getTwilioStatus } from '@/app/actions/twilio';
import { getAllPlatformStatuses } from '@/app/actions/platforms';
import { syncAllIntegrationsAction } from '@/app/actions/integrations';
import { parseMessage } from '@/lib/ai-parser';
import { buildPulseAnalytics } from '@/lib/pulse-analytics';
import { getMessageBadge } from '@/lib/message-display';
import { getSendCapabilities } from '@/lib/outbound';
import type { Insight, Message, PlatformId } from '@/lib/types';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

export function DashboardClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [name, setName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [accounts, setAccounts] = useState<
    Array<{ id: number; platformId: PlatformId; identifier: string }>
  >([]);
  const [connectionSummary, setConnectionSummary] = useState<
    Array<{ platform: string; count: number; canSend: boolean }>
  >([]);

  async function load() {
    const user = await getCurrentUserAction();
    if (!user) {
      router.replace('/login?redirect=/dashboard');
      return;
    }
    setName(user.name || user.email.split('@')[0]);

    const [msgs, cas, g, o, t, p] = await Promise.all([
      getUserMessages(),
      getConnectedAccounts(),
      getGmailStatus(),
      getOutlookStatus(),
      getTwilioStatus(),
      getAllPlatformStatuses(),
    ]);
    setMessages(msgs.messages);
    setInsights(msgs.insights);
    setAccounts(cas as Array<{ id: number; platformId: PlatformId; identifier: string }>);

    const platformIds = [...new Set(cas.map((a: { platformId: string }) => a.platformId))] as PlatformId[];
    const caps = getSendCapabilities(platformIds);
    const summary: Array<{ platform: string; count: number; canSend: boolean }> = [];
    if (g.connections?.length)
      summary.push({ platform: 'Gmail', count: g.connections.length, canSend: false });
    if (o.connections?.length)
      summary.push({ platform: 'Outlook', count: o.connections.length, canSend: false });
    if (t.connections?.length)
      summary.push({ platform: 'SMS', count: t.connections.length, canSend: true });
    if (p.slack.connections?.length)
      summary.push({ platform: 'Slack', count: p.slack.connections.length, canSend: false });
    if (p.discord.connections?.length)
      summary.push({ platform: 'Discord', count: p.discord.connections.length, canSend: false });
    if (p.telegram.connections?.length)
      summary.push({ platform: 'Telegram', count: p.telegram.connections.length, canSend: true });
    if (p.whatsapp.connections?.length)
      summary.push({ platform: 'WhatsApp', count: p.whatsapp.connections.length, canSend: true });
    if (p.x.connections?.length)
      summary.push({ platform: 'X', count: p.x.connections.length, canSend: false });
    // ensure canSend flags from caps when platform present
    for (const row of summary) {
      const cap = caps.find((c) => c.label === row.platform || c.platform === row.platform.toLowerCase());
      if (row.platform === 'SMS') row.canSend = caps.find((c) => c.platform === 'sms')?.canSend ?? false;
      if (row.platform === 'WhatsApp') row.canSend = caps.find((c) => c.platform === 'whatsapp')?.canSend ?? false;
      if (row.platform === 'Telegram') row.canSend = caps.find((c) => c.platform === 'telegram')?.canSend ?? false;
      void cap;
    }
    setConnectionSummary(summary);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => router.replace('/login?redirect=/dashboard'));
  }, [router]);

  const pulse = useMemo(() => buildPulseAnalytics(messages, insights), [messages, insights]);
  const recent = useMemo(
    () =>
      [...messages]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10),
    [messages]
  );

  async function handleSyncAll() {
    setSyncing(true);
    try {
      const r = await syncAllIntegrationsAction();
      if (r.error) toast.error(r.error);
      else toast.success(`Synced — imported ${r.totalImported ?? 0} messages`);
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      let n = 0;
      for (const m of messages) {
        if (insights[m.id]) continue;
        const ins = parseMessage(m.body, m.from);
        ins.messageId = m.id;
        await saveInsight(ins);
        n++;
      }
      toast.success(n ? `Analyzed ${n} messages` : 'Everything already analyzed');
      await load();
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <UserShell>
        <LoadingSpinner message="Loading your dashboard..." />
      </UserShell>
    );
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <UserShell>
      <div className="space-y-6">
        {/* Hero */}
        <section className="rounded-2xl border border-border bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{greet}</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-0.5 capitalize">
                {name}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                Review messages across every connected app, spot bills and subscriptions, and send
                where your channels support it.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {['Unified inbox', 'AI bills & subs', 'Cancel guides', 'Push alerts'].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border bg-background/80"
                  >
                    <Zap size={12} className="text-indigo-500" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/compose" className="btn btn-primary text-sm inline-flex gap-1.5">
                <PenSquare size={16} /> Compose
              </Link>
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncing}
                className="btn btn-secondary text-sm inline-flex gap-1.5 disabled:opacity-60"
              >
                {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Sync all
              </button>
              <Link href="/settings" className="btn btn-secondary text-sm inline-flex gap-1.5">
                <Plug size={16} /> Connections
              </Link>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            icon={<DollarSign size={14} className="text-emerald-500" />}
            label="Monthly burn"
            value={pulse.monthlyRecurringLabel}
            sub={`${pulse.activeSubCount} subscriptions`}
          />
          <Kpi
            icon={<Mail size={14} className="text-sky-500" />}
            label="Total detected"
            value={pulse.totalDetectedLabel}
            sub={`${pulse.withAmountCount} charges`}
          />
          <Kpi
            icon={<MessageSquare size={14} className="text-amber-500" />}
            label="Upcoming bills"
            value={pulse.upcomingBillsLabel}
            sub={`${pulse.billCount} bills`}
          />
          <Kpi
            icon={<Plug size={14} className="text-violet-500" />}
            label="Connections"
            value={String(connectionSummary.reduce((a, c) => a + c.count, 0))}
            sub={`${connectionSummary.length} platforms`}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Connections */}
          <section className="lg:col-span-1 card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Connected services</h2>
              <Link href="/settings" className="text-xs text-indigo-500 hover:underline">
                Manage
              </Link>
            </div>
            {connectionSummary.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-3">
                <p>No apps connected yet.</p>
                <Link href="/settings" className="btn btn-primary text-sm inline-flex">
                  Connect apps <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {connectionSummary.map((c) => (
                  <li
                    key={c.platform}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{c.platform}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.count} account{c.count === 1 ? '' : 's'}
                        {c.canSend ? ' · can send' : ' · read'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        href={`/inbox`}
                        className="btn btn-secondary text-[11px] px-2 py-1 min-h-0"
                      >
                        View
                      </Link>
                      {c.canSend && (
                        <Link
                          href={`/compose?platform=${c.platform === 'SMS' ? 'sms' : c.platform.toLowerCase()}`}
                          className="btn btn-primary text-[11px] px-2 py-1 min-h-0"
                        >
                          Send
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent + attention */}
          <section className="lg:col-span-2 space-y-4">
            <div className="card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Recent messages</h2>
                <Link href="/inbox" className="text-xs text-indigo-500 hover:underline inline-flex items-center gap-1">
                  Open inbox <ArrowRight size={12} />
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No messages yet. Connect apps and sync, or seed demo data from Settings.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((m) => {
                    const badge = getMessageBadge(m);
                    const ins = insights[m.id];
                    return (
                      <li key={m.id}>
                        <Link
                          href={`/inbox?messageId=${encodeURIComponent(m.id)}`}
                          className="flex items-start gap-3 py-2.5 hover:bg-muted/40 -mx-1 px-1 rounded-lg"
                        >
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-white shrink-0 mt-0.5"
                            style={{ backgroundColor: badge.color }}
                          >
                            {badge.name}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-2">
                              <span className="font-medium text-sm truncate">{m.from}</span>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {formatRelativeTime(m.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {m.subject || m.body}
                            </p>
                          </div>
                          {ins?.amount != null && (
                            <span className="text-xs tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                              {formatCurrency(ins.amount, ins.currency)}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="card p-4 sm:p-5 space-y-3 border-amber-500/20 bg-amber-500/5">
              <h2 className="font-semibold flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" /> Needs attention
              </h2>
              <ul className="space-y-2 text-sm">
                {pulse.unparsedCount > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2">
                    <span>{pulse.unparsedCount} messages not analyzed</span>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="btn btn-secondary text-xs"
                    >
                      {analyzing ? 'Analyzing…' : 'Analyze now'}
                    </button>
                  </li>
                )}
                {pulse.largestSubscription?.monthlyAmount != null && (
                  <li className="text-muted-foreground">
                    Largest sub:{' '}
                    <span className="text-foreground font-medium">
                      {pulse.largestSubscription.vendor}
                    </span>{' '}
                    ·{' '}
                    {formatCurrency(
                      pulse.largestSubscription.monthlyAmount,
                      pulse.largestSubscription.currency
                    )}
                    /mo — review on{' '}
                    <Link href="/inbox?view=pulse" className="text-indigo-500 hover:underline">
                      Pulse
                    </Link>
                  </li>
                )}
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Bell size={14} /> Enable browser push for new messages
                  </span>
                  <Link href="/settings#notifications" className="btn btn-secondary text-xs">
                    Notifications
                  </Link>
                </li>
                {pulse.unparsedCount === 0 && !pulse.largestSubscription && (
                  <li className="text-muted-foreground">You&apos;re caught up — nice work.</li>
                )}
              </ul>
            </div>
          </section>
        </div>

        {/* Quick compose teaser */}
        <section className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Send a message</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              SMS, WhatsApp, and Telegram when connected. Email send coming with expanded OAuth scopes.
            </p>
          </div>
          <Link href="/compose" className="btn btn-primary text-sm inline-flex gap-1.5 shrink-0">
            Open compose <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </UserShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {icon}
        {label}
      </div>
      <div className="text-lg sm:text-xl font-semibold tabular-nums mt-1 break-words tracking-tight">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
