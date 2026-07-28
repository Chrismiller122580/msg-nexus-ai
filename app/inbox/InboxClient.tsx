"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, RefreshCw, Download, Trash2, X, Play, BarChart3,
  Inbox, Calendar, DollarSign, Users, Filter, LogOut, Settings, Mail, Loader2, Shield,
  ChevronDown, TrendingUp, ShoppingBag, Receipt, Repeat, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '../components/ThemeToggle';
import { Message, Insight, PlatformId, Category, RankedMessage } from '../../lib/types';
import { PLATFORMS, getPlatform } from '../../lib/platforms';
import { getMessageBadge } from '../../lib/message-display';
import { parseMessage } from '../../lib/ai-parser';
import { searchMessages } from '../../lib/semantic-search';
import { getCancelGuide } from '../../lib/subscription-cancel';
import { buildPulseAnalytics } from '../../lib/pulse-analytics';
import {
  formatRelativeTime,
  formatCurrency,
  intervalSuffix,
  cn,
  downloadJson,
} from '../../lib/utils';
import { logoutAction } from '../actions/auth';
import {
  getUserMessages, saveInsight,
  deleteUserMessage, resetUserData,
} from '../actions/messages';
import { getConnectedAccounts } from '../actions/onboarding';
import { getCurrentUserAction } from '../actions/user';
import { getGmailStatus, syncGmailAction } from '../actions/gmail';
import { getTwilioStatus, sendSmsAction } from '../actions/twilio';
import { MsgNexusLogo } from '../components/MsgNexusLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SubscriptionCancelHelp } from '../components/SubscriptionCancelHelp';

type ViewMode = 'inbox' | 'pulse';

interface Filters {
  platforms: Set<PlatformId>;
  categories: Set<Category>;
}

const ALL_CATEGORIES: Category[] = ['subscription', 'bill', 'shopping', 'other'];

export default function InboxClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [authState, setAuthState] = useState<'loading' | 'ready'>('loading');
  const [dataState, setDataState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [user, setUser] = useState<{ email: string; name?: string; isStaff?: boolean } | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<Array<{id: number; platformId: PlatformId; identifier: string; label?: string}>>([]);
  const [gmailStatus, setGmailStatus] = useState<{
    configured: boolean;
    connected: boolean;
    email?: string;
    lastSyncedAt?: string;
  }>({ configured: false, connected: false });
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [twilioSmsConnected, setTwilioSmsConnected] = useState(false);
  const [smsReplyText, setSmsReplyText] = useState('');
  const [sendingSmsReply, setSendingSmsReply] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [askQuery, setAskQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => ({
    platforms: new Set(PLATFORMS.map((p) => p.id)),
    categories: new Set(ALL_CATEGORIES),
  }));

  useEffect(() => {
    async function loadAuth() {
      try {
        const u = await getCurrentUserAction();
        if (!u) {
          router.replace('/login?redirect=/inbox');
          return;
        }
        setUser(u);
        const [cas, gmail, twilio] = await Promise.all([getConnectedAccounts(), getGmailStatus(), getTwilioStatus()]);
        setConnectedAccounts(cas);
        setGmailStatus(gmail);
        setTwilioSmsConnected(twilio.connected);

        const platformIds = [...new Set(cas.map((a: { platformId: string }) => a.platformId))];
        const platforms =
          platformIds.length > 0
            ? PLATFORMS.filter((p) => platformIds.includes(p.id))
            : PLATFORMS;
        setFilters({
          platforms: new Set(platforms.map((p) => p.id)),
          categories: new Set(ALL_CATEGORIES),
        });

        setAuthState('ready');
      } catch {
        router.replace('/login?redirect=/inbox');
      }
    }
    loadAuth();
  }, [router]);

  const connectedPlatformIds = useMemo(
    () => [...new Set(connectedAccounts.map((a) => a.platformId))],
    [connectedAccounts]
  );

  const availablePlatforms = useMemo(
    () =>
      connectedPlatformIds.length > 0
        ? PLATFORMS.filter((p) => connectedPlatformIds.includes(p.id))
        : PLATFORMS,
    [connectedPlatformIds]
  );

  const defaultFilters = useMemo<Filters>(
    () => ({
      platforms: new Set(availablePlatforms.map((p) => p.id)),
      categories: new Set(ALL_CATEGORIES),
    }),
    [availablePlatforms]
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [view, setView] = useState<ViewMode>('inbox');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);


  useEffect(() => {
    const gmailParam = searchParams.get('gmail');
    if (gmailParam === 'synced') {
      toast.success('Gmail connected — your emails are syncing in');
      router.replace('/inbox');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (authState !== 'ready') return;

    async function load() {
      setDataState('loading');
      try {
        const data = await getUserMessages();
        setMessages(data.messages);
        setInsights(data.insights);
      } catch (e) {
        console.error('Failed to load from DB', e);
        toast.error('Failed to load messages', {
          description: 'Check your database connection and refresh.',
        });
      } finally {
        setDataState('ready');
      }
    }

    load();
  }, [authState]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSelectedMessageId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Prevent background scroll while mobile message sheet is open
  useEffect(() => {
    if (!selectedMessageId) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedMessageId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 180);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // No more localStorage persist - everything goes to the DB via server actions

  // Filter messages to only connected platforms (supporting multiple accounts per platform)
  const filteredMessages = useMemo(() => {
    if (connectedAccounts.length === 0) return messages;
    const activePlatformIds = new Set(connectedAccounts.map(a => a.platformId));
    return messages.filter(m => activePlatformIds.has(m.platformId));
  }, [messages, connectedAccounts]);

  const ranked = useMemo<RankedMessage[]>(() => {
    let base = searchMessages(debouncedQuery, filteredMessages, insights);

    base = base.filter((r) => {
      const platOk = filters.platforms.has(r.message.platformId);
      const cat = r.insight?.category || 'other';
      const catOk = filters.categories.has(cat);
      return platOk && catOk;
    });

    if (!debouncedQuery.trim()) {
      base = [...base].sort((a, b) =>
        new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime()
      );
    }
    return base;
  }, [debouncedQuery, filteredMessages, insights, filters]);

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null;
    return messages.find(m => m.id === selectedMessageId) || null;
  }, [selectedMessageId, messages]);

  const selectedInsight = selectedMessage ? insights[selectedMessage.id] : undefined;

  const askResults = useMemo(() => {
    if (!askQuery.trim()) return [];
    return searchMessages(askQuery, filteredMessages, insights).slice(0, 8);
  }, [askQuery, filteredMessages, insights]);

  useEffect(() => {
    setSmsReplyText('');
  }, [selectedMessageId]);

  const pulse = useMemo(
    () => buildPulseAnalytics(filteredMessages, insights),
    [filteredMessages, insights]
  );

  const unparsedCount = filteredMessages.length - Object.keys(insights).filter(id => 
    filteredMessages.some(m => m.id === id)
  ).length;

  function togglePlatform(id: PlatformId) {
    setFilters(prev => {
      const next = new Set(prev.platforms);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, platforms: next };
    });
  }

  function toggleCategory(cat: Category) {
    setFilters(prev => {
      const next = new Set(prev.categories);
      if (next.has(cat)) {
        if (next.size === 1) return prev;
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return { ...prev, categories: next };
    });
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setSearchQuery('');
  }

  async function runParse(messageId: string) {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const ins = parseMessage(msg.body, msg.from);
    ins.messageId = messageId;
    setInsights(prev => ({ ...prev, [messageId]: ins }));
    await saveInsight(ins); // persist to DB
    toast.success('AI analysis complete', { description: ins.summary });
  }

  async function runParseAllUnparsed() {
    const toAnalyze = filteredMessages.filter(m => !insights[m.id]);
    if (toAnalyze.length === 0) {
      toast.info('All messages already analyzed');
      return;
    }
    const newInsights = { ...insights };
    for (const m of toAnalyze) {
      const ins = parseMessage(m.body, m.from);
      ins.messageId = m.id;
      newInsights[m.id] = ins;
      await saveInsight(ins);
    }
    setInsights(newInsights);
    toast.success(`Analyzed ${toAnalyze.length} messages`);
  }

  async function deleteMessage(id: string) {
    await deleteUserMessage(id);
    setMessages(prev => prev.filter(m => m.id !== id));
    setInsights(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (selectedMessageId === id) setSelectedMessageId(null);
    toast('Message deleted');
  }

  function selectMessage(id: string) {
    setSelectedMessageId(id);
    if (!insights[id]) setTimeout(() => runParse(id), 60);
  }

  function exportData() {
    const payload = { messages, insights, exportedAt: new Date().toISOString() };
    downloadJson('msgnexus-export.json', payload);
    toast.success('Exported');
  }

  async function handleGmailSync() {
    setSyncingGmail(true);
    try {
      const result = await syncGmailAction();
      if (result.error) {
        toast.error(result.error, { duration: 10000 });
        return;
      }
      const refreshed = await getUserMessages();
      setMessages(refreshed.messages);
      setInsights(refreshed.insights);
      setGmailStatus(await getGmailStatus());
      if ((result.imported ?? 0) === 0 && result.info) {
        toast.info(result.info, { duration: 10000 });
      } else {
        toast.success(
          `Imported ${result.imported ?? 0} new email${result.imported === 1 ? '' : 's'} from Gmail${
            result.info ? ` — ${result.info}` : ''
          }`
        );
      }
    } finally {
      setSyncingGmail(false);
    }
  }

  async function handleLogout() {
    await logoutAction();
    router.push('/');
  }

  const platformCounts = useMemo(() => {
    const counts: Record<PlatformId, number> = PLATFORMS.reduce((acc, p) => { acc[p.id] = 0; return acc; }, {} as Record<PlatformId, number>);
    filteredMessages.forEach(m => { counts[m.platformId] = (counts[m.platformId] || 0) + 1; });
    return counts;
  }, [filteredMessages]);

  const categoryCounts = useMemo(() => {
    const c: Record<Category, number> = { bill: 0, subscription: 0, shopping: 0, other: 0 };
    Object.values(insights).forEach(ins => { c[ins.category] = (c[ins.category] || 0) + 1; });
    return c;
  }, [insights]);

  const emailMessageCount = useMemo(
    () => messages.filter((m) => m.platformId === 'email').length,
    [messages]
  );

  const showGmailCta =
    gmailStatus.connected &&
    emailMessageCount === 0 &&
    messages.length > 0;

  const isEmptyInbox = messages.length === 0 && dataState === 'ready';

  if (authState === 'loading' || !user || dataState === 'loading' || dataState === 'idle') {
    return <LoadingSpinner message="Loading your inbox..." />;
  }

  const filtersPanel = (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="uppercase tracking-[1px] text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Users size={14} /> {connectedAccounts.length > 0 ? 'CONNECTED ACCOUNTS' : 'PLATFORMS'}
        </div>
        <div className="space-y-1">
          {connectedAccounts.length > 0 ? (
            connectedAccounts.map((acc) => {
              const plat = getPlatform(acc.platformId);
              const active = filters.platforms.has(acc.platformId);
              const display = acc.label ? `${acc.identifier} (${acc.label})` : acc.identifier;
              return (
                <button
                  key={acc.id}
                  onClick={() => togglePlatform(acc.platformId)}
                  className={cn(
                    'w-full flex justify-between items-center text-left px-3 py-2.5 rounded-xl text-sm transition min-h-[44px]',
                    active ? 'bg-muted' : 'hover:bg-muted text-muted-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: plat.color }} />
                    <span className="truncate">{plat.name}: {display}</span>
                  </div>
                </button>
              );
            })
          ) : (
            availablePlatforms.map((p) => {
              const active = filters.platforms.has(p.id);
              const count = platformCounts[p.id] || 0;
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    'w-full flex justify-between items-center text-left px-3 py-2.5 rounded-xl text-sm transition min-h-[44px]',
                    active ? 'bg-muted' : 'hover:bg-muted text-muted-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{count}</span>
                </button>
              );
            })
          )}
        </div>
        {connectedAccounts.length > 0 && (
          <Link href="/settings" className="text-xs block mt-3 text-accent hover:underline">+ Manage integrations</Link>
        )}
      </div>

      <div className="card p-4">
        <div className="uppercase tracking-[1px] text-xs font-semibold text-muted-foreground mb-3">CATEGORIES</div>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => {
            const active = filters.categories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn('filter-chip min-h-[36px]', active && 'active')}
              >
                {cat}
                <span className="ml-1 opacity-60 tabular-nums">({categoryCounts[cat] || 0})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const messageDetailContent = selectedMessage ? (
    <>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          {(() => {
            const badge = getMessageBadge(selectedMessage);
            return (
              <div className="platform-badge text-white inline-block" style={{ backgroundColor: badge.color }}>
                {badge.name}
              </div>
            );
          })()}
          <div className="font-semibold text-lg mt-1 break-words">{selectedMessage.from}</div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedMessageId(null)}
          className="p-2 rounded-xl hover:bg-muted shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close detail"
        >
          <X size={18} />
        </button>
      </div>

      <div className="divider my-4" />

      <div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/60 p-4 rounded-2xl border border-border break-words">
        {selectedMessage.body}
      </div>

      <div className="mt-4 flex-1">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="uppercase text-xs tracking-widest text-muted-foreground">AI Insight</div>
          <button onClick={() => runParse(selectedMessage.id)} className="text-xs text-accent flex items-center gap-1 min-h-[36px]">
            <Play size={13} /> Re-analyze
          </button>
        </div>

        {selectedInsight ? (
          <div className="space-y-3">
            <div className="card p-3 text-sm">
              <div className="font-medium mb-1">{selectedInsight.summary}</div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span>Category: <span className="text-foreground">{selectedInsight.category}</span></span>
                {selectedInsight.vendor && <span>Vendor: <span className="text-foreground">{selectedInsight.vendor}</span></span>}
                {selectedInsight.amount != null && (
                  <span>
                    Amount:{' '}
                    <span className="text-emerald-500">
                      {formatCurrency(selectedInsight.amount, selectedInsight.currency)}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {(selectedInsight.category === 'subscription' || selectedInsight.isRecurring) && (
              <SubscriptionCancelHelp
                guide={getCancelGuide(selectedInsight.vendor, selectedMessage.body)}
                compact
              />
            )}
          </div>
        ) : (
          <button onClick={() => runParse(selectedMessage.id)} className="btn btn-primary w-full min-h-[44px]">Run AI Analysis</button>
        )}
      </div>

      {selectedMessage.platformId === 'sms' && twilioSmsConnected ? (
        <div className="mt-4 space-y-2">
          <textarea
            value={smsReplyText}
            onChange={(e) => setSmsReplyText(e.target.value)}
            rows={2}
            placeholder={`Reply to ${selectedMessage.from}...`}
            className="w-full bg-input border border-input-border rounded-2xl px-3 py-2 text-sm resize-none"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => deleteMessage(selectedMessage.id)} className="btn btn-secondary flex-1 text-red-500 min-h-[44px]">Delete</button>
            <button
              disabled={sendingSmsReply || !smsReplyText.trim()}
              onClick={async () => {
                setSendingSmsReply(true);
                try {
                  const r = await sendSmsAction(selectedMessage.from, smsReplyText.trim());
                  if (r.error) throw new Error(r.error);
                  toast.success('SMS sent');
                  setSmsReplyText('');
                  const data = await getUserMessages();
                  setMessages(data.messages);
                  setInsights(data.insights);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Send failed');
                } finally {
                  setSendingSmsReply(false);
                }
              }}
              className="btn btn-primary flex-1 disabled:opacity-50 min-h-[44px]"
            >
              {sendingSmsReply ? 'Sending…' : 'Reply via SMS'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button onClick={() => deleteMessage(selectedMessage.id)} className="btn btn-secondary flex-1 text-red-500 min-h-[44px]">Delete</button>
          {selectedMessage.platformId === 'sms' && !twilioSmsConnected && (
            <Link href="/settings" className="btn btn-secondary flex-1 text-center min-h-[44px]">Connect SMS in Settings</Link>
          )}
        </div>
      )}
    </>
  ) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50 safe-area-top">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MsgNexusLogo href="/inbox" />
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 text-sm shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-muted-foreground text-sm mr-1 max-w-[200px] truncate">
              <span className="truncate">{user.email}</span>
            </div>

            <Link
              href="/settings"
              className="btn btn-ghost text-xs flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-2 sm:px-4"
              title="Integrations and settings"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            {user.isStaff && (
              <Link
                href="/admin"
                className="btn btn-ghost text-xs flex items-center gap-1.5 text-accent min-h-[44px] min-w-[44px] px-2 sm:px-4"
                title="Admin portal"
              >
                <Shield size={16} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="btn btn-ghost text-xs flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-2 sm:px-4"
              title="Log out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {showGmailCta && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 text-sm px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 max-w-[1400px] mx-auto w-full">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <Mail size={16} className="text-blue-500 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">
              Gmail is connected as <span className="font-medium">{gmailStatus.email}</span> but no emails imported yet.
            </span>
          </div>
          <button
            onClick={handleGmailSync}
            disabled={syncingGmail}
            className="btn btn-primary text-xs disabled:opacity-70 min-h-[40px] w-full sm:w-auto"
          >
            {syncingGmail ? (
              <><Loader2 className="animate-spin" size={14} /> Syncing...</>
            ) : (
              <><RefreshCw size={14} /> Sync Gmail now</>
            )}
          </button>
        </div>
      )}

      {connectedAccounts.length > 0 && (
        <div className="bg-muted border-b border-border text-sm px-3 sm:px-6 py-2 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Showing messages from <span className="font-medium">{connectedAccounts.length}</span> connected account{connectedAccounts.length !== 1 ? 's' : ''}
            </span>
            <Link href="/settings" className="underline">Connect integrations</Link>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="max-w-[1400px] mx-auto w-full px-3 sm:px-6 pt-3 sm:pt-4 pb-3 space-y-3">
        <div className="relative w-full">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Search size={17} />
          </div>
          <input
            ref={searchInputRef}
            id="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="search-input pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAsk((v) => !v)}
            className={cn('btn min-h-[40px]', showAsk ? 'btn-primary' : 'btn-secondary')}
            title="Ask MsgNexus — semantic search over your messages"
          >
            Ask
          </button>
          <button
            onClick={() => setView('inbox')}
            className={cn('btn min-h-[40px]', view === 'inbox' ? 'btn-primary' : 'btn-secondary')}
          >
            <Inbox size={16} />
            <span className="hidden xs:inline sm:inline">Inbox</span>
          </button>
          <button
            onClick={() => setView('pulse')}
            className={cn('btn min-h-[40px]', view === 'pulse' ? 'btn-primary' : 'btn-secondary')}
          >
            <BarChart3 size={16} />
            <span className="hidden xs:inline sm:inline">Pulse</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn('btn min-h-[40px] lg:hidden', showFilters ? 'btn-primary' : 'btn-secondary')}
            aria-expanded={showFilters}
          >
            <Filter size={15} />
            Filters
            <ChevronDown size={14} className={cn('transition-transform', showFilters && 'rotate-180')} />
          </button>
          <button onClick={resetFilters} className="btn btn-ghost text-xs min-h-[40px] hidden sm:inline-flex">
            <Filter size={15} /> Reset
          </button>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <button onClick={runParseAllUnparsed} className="btn btn-secondary text-sm min-h-[40px]" disabled={unparsedCount === 0}>
              <Play size={16} />
              <span className="hidden sm:inline">Analyze</span>
            </button>
            <button onClick={exportData} className="btn btn-ghost min-h-[40px] min-w-[40px] px-2" title="Export your data">
              <Download size={16} />
            </button>
            <button
              onClick={async () => {
                if (confirm('Clear all your data? This cannot be undone.')) {
                  await resetUserData();
                  setMessages([]);
                  setInsights({});
                  setSelectedMessageId(null);
                  toast('Data cleared from database');
                }
              }}
              className="btn btn-ghost text-red-400 min-h-[40px] min-w-[40px] px-2"
              title="Clear your data"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Mobile filters (collapsible) */}
        {showFilters && (
          <div className="lg:hidden">
            {filtersPanel}
            <button onClick={resetFilters} className="btn btn-ghost text-xs w-full mt-2 min-h-[40px] sm:hidden">
              <Filter size={15} /> Reset filters
            </button>
          </div>
        )}
      </div>

      {showAsk && (
        <div className="max-w-[1400px] mx-auto w-full px-3 sm:px-6 pb-3">
          <div className="card p-4 space-y-3">
            <div className="text-sm font-medium">Ask MsgNexus</div>
            <p className="text-xs text-muted-foreground">
              Natural-language search over your messages — try &quot;netflix subscription&quot;, &quot;rent due&quot;, or &quot;amazon orders&quot;.
            </p>
            <input
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder="What are you looking for?"
              className="search-input pl-4"
            />
            {askQuery.trim() && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {askResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No matching messages found.</p>
                ) : (
                  askResults.map((r) => (
                    <button
                      key={r.message.id}
                      type="button"
                      onClick={() => { setSelectedMessageId(r.message.id); setView('inbox'); }}
                      className="w-full text-left rounded-xl border border-border p-3 hover:bg-muted/60 transition text-sm min-h-[44px]"
                    >
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground mb-1">
                        <span className="truncate">{r.message.from}</span>
                        <span className="shrink-0">{Math.round(r.score * 100)}% match</span>
                      </div>
                      <div className="line-clamp-2">{r.message.body}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto w-full flex-1 px-3 sm:px-6 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Desktop sidebar filters */}
        <div className="hidden lg:block lg:col-span-3 space-y-4">
          {filtersPanel}
        </div>

        {/* Main Area */}
        <div className="lg:col-span-5 xl:col-span-6 flex flex-col min-w-0">
          {view === 'inbox' ? (
            <>
              <div className="flex items-baseline justify-between mb-2 px-1 text-sm text-muted-foreground">
                {debouncedQuery ? `${ranked.length} semantic matches` : `${ranked.length} messages`}
              </div>

              <div className="panel flex-1 overflow-hidden">
                <div className="overflow-auto max-h-[min(70vh,calc(100dvh-16rem))] lg:h-[calc(100vh-210px)] lg:max-h-none p-2 space-y-2">
                  {ranked.length === 0 && (
                    <div className="p-6 sm:p-8 text-center text-muted-foreground">
                      {isEmptyInbox ? (
                        <div className="space-y-4">
                          <Inbox size={40} className="mx-auto opacity-40" />
                          <div className="font-medium text-foreground">Your inbox is empty</div>
                          <p className="text-sm max-w-sm mx-auto">
                            Connect your messaging apps in Settings, then sync to pull in messages.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <Link href="/settings" className="btn btn-primary text-sm min-h-[44px]">
                              <Settings size={15} /> Connect apps
                            </Link>
                            {gmailStatus.connected && (
                              <button onClick={handleGmailSync} disabled={syncingGmail} className="btn btn-secondary text-sm min-h-[44px]">
                                {syncingGmail ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                                Sync Gmail
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          No messages match your filters.
                          <button onClick={resetFilters} className="underline ml-1">Clear</button>
                        </>
                      )}
                    </div>
                  )}

                  {ranked.map(({ message, score, insight }) => {
                    const badge = getMessageBadge(message);
                    const isActive = selectedMessageId === message.id;
                    const preview = message.body.length > 140 ? message.body.slice(0, 137) + '...' : message.body;

                    return (
                      <div
                        key={message.id}
                        onClick={() => selectMessage(message.id)}
                        className={cn('message-card', isActive && 'active')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectMessage(message.id);
                          }
                        }}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="platform-badge text-white shrink-0 mt-0.5" style={{ backgroundColor: badge.color }}>
                            {badge.name}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground truncate max-w-full">{message.from}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="shrink-0">{formatRelativeTime(message.timestamp)}</span>
                              {debouncedQuery && (
                                <span className="sm:ml-auto text-[10px] px-1.5 py-px rounded bg-muted tabular-nums">
                                  {Math.round(score * 100)}% match
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-sm leading-snug text-foreground break-words">
                              {message.subject && <span className="font-medium mr-1.5 text-muted-foreground">{message.subject}</span>}
                              <span className="line-clamp-3 sm:line-clamp-none whitespace-pre-wrap sm:whitespace-pre-wrap">{preview}</span>
                            </div>

                            {insight && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <div className="insight-chip">{insight.category}</div>
                                {insight.vendor && <div className="insight-chip">{insight.vendor}</div>}
                                {insight.amount != null && (
                                  <div className="insight-chip font-medium">
                                    {formatCurrency(insight.amount, insight.currency)}
                                  </div>
                                )}
                              </div>
                            )}

                            {!insight && (
                              <button
                                onClick={(e) => { e.stopPropagation(); runParse(message.id); }}
                                className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted min-h-[36px]"
                              >
                                <Play size={13} className="inline mr-1" /> Run AI parse
                              </button>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMessage(message.id); }}
                            className="text-muted-foreground hover:text-red-500 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
                            aria-label="Delete message"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              {/* Primary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="pulse-card">
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-medium uppercase tracking-wide">
                    <Repeat size={14} /> Monthly burn
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tighter mt-2 break-words">
                    {pulse.monthlyRecurringLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pulse.activeSubCount} active sub{pulse.activeSubCount === 1 ? '' : 's'}
                    {pulse.subscriptions.some((c) => c.billingInterval === 'year') ? ' · annual ÷ 12' : ''}
                  </div>
                </div>
                <div className="pulse-card">
                  <div className="flex items-center gap-2 text-violet-500 text-xs font-medium uppercase tracking-wide">
                    <TrendingUp size={14} /> Est. annual
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tighter mt-2 break-words">
                    {pulse.annualRunRateLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    avg {pulse.avgSubscriptionLabel}/mo per sub
                  </div>
                </div>
                <div className="pulse-card">
                  <div className="flex items-center gap-2 text-sky-500 text-xs font-medium uppercase tracking-wide">
                    <DollarSign size={14} /> Total detected
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tighter mt-2 break-words">
                    {pulse.totalDetectedLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pulse.withAmountCount} charge{pulse.withAmountCount === 1 ? '' : 's'} in inbox
                  </div>
                </div>
                <div className="pulse-card">
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-medium uppercase tracking-wide">
                    <Calendar size={14} /> Upcoming bills
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tighter mt-2 break-words">
                    {pulse.upcomingBillsLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pulse.billCount} bill{pulse.billCount === 1 ? '' : 's'} detected
                  </div>
                </div>
              </div>

              {/* Time windows */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="pulse-card">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">This month</div>
                  <div className="text-xl font-semibold tabular-nums mt-1 break-words">{pulse.spentThisMonthLabel}</div>
                </div>
                <div className="pulse-card">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Last 30 days</div>
                  <div className="text-xl font-semibold tabular-nums mt-1 break-words">{pulse.spentLast30DaysLabel}</div>
                </div>
                <div className="pulse-card">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Parsed coverage</div>
                  <div className="text-xl font-semibold tabular-nums mt-1">
                    {pulse.parsedCount}
                    <span className="text-muted-foreground font-normal text-base"> / {pulse.messageCount}</span>
                  </div>
                  {pulse.unparsedCount > 0 && (
                    <div className="text-[11px] text-amber-600 mt-1">{pulse.unparsedCount} still need analysis</div>
                  )}
                </div>
              </div>

              {/* Category breakdown */}
              <div className="pulse-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">Spend by category</div>
                  <div className="text-[11px] text-muted-foreground">Primary: {pulse.primaryCurrency}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {pulse.categoryBreakdown.map((c) => {
                    const Icon =
                      c.category === 'subscription' ? Repeat : c.category === 'bill' ? Receipt : ShoppingBag;
                    const color =
                      c.category === 'subscription'
                        ? 'bg-emerald-500'
                        : c.category === 'bill'
                          ? 'bg-amber-500'
                          : 'bg-sky-500';
                    return (
                      <div key={c.category} className="rounded-xl border border-border/60 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Icon size={14} className="text-muted-foreground" />
                          {c.label}
                          <span className="text-xs text-muted-foreground font-normal">({c.count})</span>
                        </div>
                        <div className="text-lg font-semibold tabular-nums break-words">{c.totalLabel}</div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(c.sharePct, c.count ? 4 : 0)}%` }} />
                        </div>
                        <div className="text-[11px] text-muted-foreground">{c.sharePct}% of {pulse.primaryCurrency} total</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active subscriptions */}
              <div className="pulse-card">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="font-semibold">Active Subscriptions</div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      One row per vendor · charged amount + monthly equivalent
                    </p>
                  </div>
                  {pulse.largestSubscription?.monthlyAmount != null && (
                    <div className="text-xs text-muted-foreground rounded-lg border border-border px-2 py-1">
                      Largest:{' '}
                      <span className="font-medium text-foreground">{pulse.largestSubscription.vendor}</span>
                      {' · '}
                      {formatCurrency(pulse.largestSubscription.monthlyAmount, pulse.largestSubscription.currency)}/mo
                    </div>
                  )}
                </div>
                {pulse.subscriptions.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-3">
                    None detected yet. Connect email/SMS and run Analyze so we can find recurring charges.
                  </div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="py-2 pr-2 font-medium">Vendor</th>
                          <th className="py-2 pr-2 font-medium text-right">Charged</th>
                          <th className="py-2 pr-2 font-medium text-right">Monthly</th>
                          <th className="py-2 font-medium text-right hidden sm:table-cell">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pulse.subscriptions.map((item) => {
                          const period = intervalSuffix(item.billingInterval) || (item.amount != null ? '' : '');
                          const monthlyShare =
                            item.monthlyAmount != null &&
                            pulse.subscriptions.reduce((a, s) => a + (s.monthlyAmount || 0), 0) > 0
                              ? Math.round(
                                  (item.monthlyAmount /
                                    pulse.subscriptions.reduce((a, s) => a + (s.monthlyAmount || 0), 0)) *
                                    100
                                )
                              : 0;
                          return (
                            <tr key={`${item.vendor}-${item.messageId}`} className="border-b border-border/50 last:border-0">
                              <td className="py-2.5 pr-2 align-top">
                                <button
                                  type="button"
                                  onClick={() => { setView('inbox'); selectMessage(item.messageId); }}
                                  className="text-left font-medium hover:underline min-h-[36px]"
                                >
                                  {item.vendor}
                                </button>
                                <div className="mt-1">
                                  <SubscriptionCancelHelp guide={item.guide} compact />
                                </div>
                              </td>
                              <td className="py-2.5 pr-2 text-right tabular-nums align-top whitespace-nowrap">
                                {item.amount != null ? (
                                  <>
                                    {formatCurrency(item.amount, item.currency)}
                                    {period ? (
                                      <span className="text-muted-foreground text-xs">{period}</span>
                                    ) : null}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2.5 pr-2 text-right tabular-nums align-top text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                                {item.monthlyAmount != null
                                  ? `${formatCurrency(item.monthlyAmount, item.currency)}/mo`
                                  : '—'}
                              </td>
                              <td className="py-2.5 text-right align-top hidden sm:table-cell">
                                <div className="inline-flex flex-col items-end gap-1 min-w-[4.5rem]">
                                  <span className="text-xs text-muted-foreground tabular-nums">{monthlyShare}%</span>
                                  <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-emerald-500"
                                      style={{ width: `${Math.max(monthlyShare, item.monthlyAmount ? 4 : 0)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border">
                          <td className="pt-3 font-medium text-muted-foreground">Total monthly</td>
                          <td />
                          <td className="pt-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {pulse.monthlyRecurringLabel}
                          </td>
                          <td className="hidden sm:table-cell" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Top vendors + recent charges */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="pulse-card">
                  <div className="font-semibold mb-1">Top vendors</div>
                  <p className="text-xs text-muted-foreground mb-3">Ranked by monthly-equivalent spend</p>
                  {pulse.topVendors.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No amounts detected yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {pulse.topVendors.map((v) => (
                        <li key={`${v.category}-${v.vendor}`}>
                          <button
                            type="button"
                            onClick={() => { setView('inbox'); selectMessage(v.messageId); }}
                            className="w-full flex items-center justify-between gap-2 text-sm p-2 rounded-xl hover:bg-muted min-h-[40px] text-left"
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-medium">{v.vendor}</span>
                              <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{v.category}</span>
                            </span>
                            <span className="tabular-nums shrink-0 text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(v.monthlyAmount || v.lastAmount, v.currency)}
                              {v.category === 'subscription' ? (
                                <span className="text-muted-foreground text-xs">/mo</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pulse-card">
                  <div className="font-semibold mb-1">Recent charges</div>
                  <p className="text-xs text-muted-foreground mb-3">Latest amounts found in messages</p>
                  {pulse.recentCharges.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No charges parsed yet.</div>
                  ) : (
                    <ul className="space-y-2">
                      {pulse.recentCharges.map((c) => (
                        <li key={c.messageId}>
                          <button
                            type="button"
                            onClick={() => { setView('inbox'); selectMessage(c.messageId); }}
                            className="w-full flex items-center justify-between gap-2 text-sm p-2 rounded-xl hover:bg-muted min-h-[40px] text-left"
                          >
                            <span className="min-w-0">
                              <span className="font-medium truncate block">{c.vendor}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatRelativeTime(c.timestamp)} · {c.category}
                              </span>
                            </span>
                            <span className="tabular-nums shrink-0 font-medium">
                              {formatCurrency(c.amount, c.currency)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {pulse.largestSubscription && pulse.activeSubCount > 0 && (
                <div className="pulse-card flex flex-col sm:flex-row sm:items-center gap-3 border-emerald-500/20 bg-emerald-500/5">
                  <Sparkles className="text-emerald-500 shrink-0" size={20} />
                  <div className="text-sm min-w-0">
                    <div className="font-medium">Savings tip</div>
                    <div className="text-muted-foreground">
                      Canceling <span className="text-foreground font-medium">{pulse.largestSubscription.vendor}</span>
                      {pulse.largestSubscription.monthlyAmount != null && (
                        <>
                          {' '}
                          could free about{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                            {formatCurrency(pulse.largestSubscription.monthlyAmount, pulse.largestSubscription.currency)}/mo
                          </span>
                          {' '}
                          ({formatCurrency((pulse.largestSubscription.monthlyAmount || 0) * 12, pulse.largestSubscription.currency)}/yr).
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button onClick={runParseAllUnparsed} className="btn btn-primary w-full min-h-[44px]">
                Re-analyze everything
              </button>
            </div>
          )}
        </div>

        {/* Desktop detail panel */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3">
          <div className="panel h-full min-h-[420px] lg:sticky lg:top-20 p-5 flex flex-col">
            {!selectedMessage ? (
              <div className="flex flex-col items-center justify-center text-center flex-1 text-muted-foreground">
                <Inbox size={42} className="mb-4 opacity-50" />
                <div>Select a message to view details and run AI analysis.</div>
              </div>
            ) : (
              messageDetailContent
            )}
          </div>
        </div>
      </div>

      {/* Mobile message detail sheet */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close message detail"
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedMessageId(null)}
          />
          <div className="absolute inset-x-0 bottom-0 top-12 sm:top-16 bg-card border-t border-border rounded-t-2xl shadow-xl flex flex-col safe-area-bottom">
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {messageDetailContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
