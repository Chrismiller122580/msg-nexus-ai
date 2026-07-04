"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Plus, RefreshCw, Download, Upload, Trash2, X, Play, BarChart3,
  Inbox, Calendar, DollarSign, Users, Filter, LogOut, Settings, Mail, Loader2, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '../components/ThemeToggle';
import { Message, Insight, PlatformId, Category, RankedMessage } from '../../lib/types';
import { PLATFORMS, getPlatform } from '../../lib/platforms';
import { createSeedMessages } from '../../lib/seed-data';
import { parseMessage } from '../../lib/ai-parser';
import { searchMessages, getTopInsights } from '../../lib/semantic-search';
import { generateId, formatRelativeTime, formatCurrency, cn, downloadJson } from '../../lib/utils';
import { logoutAction } from '../actions/auth';
import {
  getUserMessages, saveMessage as saveMessageAction, saveInsight,
  deleteUserMessage, resetUserData, importUserMessages,
} from '../actions/messages';
import { getConnectedAccounts } from '../actions/onboarding';
import { getCurrentUserAction } from '../actions/user';
import { getGmailStatus, syncGmailAction } from '../actions/gmail';
import { getTwilioStatus, sendSmsAction } from '../actions/twilio';
import { MsgNexusLogo } from '../components/MsgNexusLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';

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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
        if (data.messages.length > 0) {
          setMessages(data.messages);
          setInsights(data.insights);
          return;
        }

        const seeds = createSeedMessages().slice(0, 12);
        const pre: Record<string, Insight> = {};

        for (const m of seeds) {
          const ins = parseMessage(m.body, m.from);
          ins.messageId = m.id;
          await saveMessageAction({ ...m });
          await saveInsight(ins);
          pre[m.id] = ins;
        }

        setMessages(seeds);
        setInsights(pre);
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

      if (e.key === '/' && !typing && !isAddOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (isAddOpen) setIsAddOpen(false);
        else setSelectedMessageId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAddOpen]);

  // Add message form
  const [addForm, setAddForm] = useState({
    platformId: (availablePlatforms[0]?.id || 'whatsapp') as PlatformId,
    from: '',
    body: '',
  });

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

  const aggregates = useMemo(() => {
    const { subs, bills, shopping, monthlyRecurring } = getTopInsights(filteredMessages, insights);
    const totalParsed = Object.keys(insights).length;
    const upcomingBills = bills
      .filter(b => b.insight.amount != null)
      .sort((a, b) => (a.insight.amount || 0) - (b.insight.amount || 0));
    const totalUpcoming = upcomingBills.reduce((sum, b) => sum + (b.insight.amount || 0), 0);

    return {
      subs,
      bills: upcomingBills,
      shopping,
      monthlyRecurring,
      totalParsed,
      totalUpcoming: Math.round(totalUpcoming * 100) / 100,
      totalMessages: filteredMessages.length,
    };
  }, [filteredMessages, insights]);

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

  function openAdd() {
    const defaultPlat = availablePlatforms[0]?.id || 'whatsapp';
    setAddForm({ platformId: defaultPlat, from: '', body: '' });
    setIsAddOpen(true);
  }

  async function submitAddMessage() {
    const { platformId, from, body } = addForm;
    if (!body.trim()) {
      toast.error('Message body is required');
      return;
    }
    const id = generateId();
    const newMsg: Message = {
      id,
      platformId,
      timestamp: new Date().toISOString(),
      from: from.trim() || 'Unknown',
      body: body.trim(),
    };

    await saveMessageAction(newMsg);
    setMessages(prev => [newMsg, ...prev]);
    setIsAddOpen(false);
    setAddForm({ platformId: (availablePlatforms[0]?.id || 'whatsapp') as PlatformId, from: '', body: '' });

    const ins = parseMessage(newMsg.body, newMsg.from);
    ins.messageId = id;
    await saveInsight(ins);

    setSelectedMessageId(id);
    setInsights(prev => ({ ...prev, [id]: ins }));
    toast.success('New message added & analyzed', { description: ins.summary });
  }

  async function resetToSeeds() {
    await resetUserData();

    // Re-seed fresh demo data
    const seeds = createSeedMessages().slice(0, 12);
    const pre: Record<string, Insight> = {};

    for (const m of seeds) {
      const ins = parseMessage(m.body, m.from);
      ins.messageId = m.id;
      await saveMessageAction(m);
      await saveInsight(ins);
      pre[m.id] = ins;
    }

    setMessages(seeds);
    setInsights(pre);
    setSelectedMessageId(null);
    setSearchQuery('');
    setFilters(defaultFilters);
    toast.success('Reset to demo data');
  }

  function exportData() {
    const payload = { messages, insights, exportedAt: new Date().toISOString() };
    downloadJson('msgnexus-export.json', payload);
    toast.success('Exported');
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result || '{}'));
        if (!Array.isArray(data.messages)) throw new Error('Invalid file format');

        const result = await importUserMessages({
          messages: data.messages,
          insights: data.insights,
        });

        if (result.error) throw new Error(result.error);

        const refreshed = await getUserMessages();
        setMessages(refreshed.messages);
        setInsights(refreshed.insights);
        setSelectedMessageId(null);

        const detail =
          result.skipped > 0
            ? `${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped`
            : undefined;
        toast.success(`Imported ${result.imported} message${result.imported === 1 ? '' : 's'}`, {
          description: detail,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Bad file';
        toast.error('Import failed', { description: message });
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function handleGmailSync() {
    setSyncingGmail(true);
    try {
      const result = await syncGmailAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const refreshed = await getUserMessages();
      setMessages(refreshed.messages);
      setInsights(refreshed.insights);
      setGmailStatus(await getGmailStatus());
      toast.success(`Imported ${result.imported ?? 0} new email${result.imported === 1 ? '' : 's'} from Gmail`);
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

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <MsgNexusLogo href="/inbox" />
            <div className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hidden md:block">
              Phase 1 • Local AI
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <div className="hidden md:flex items-center gap-2 text-muted-foreground text-sm mr-1">
              <span>{user.email}</span>
            </div>

            <Link 
              href="/settings" 
              className="btn btn-ghost text-xs flex items-center gap-1.5"
              title="Integrations and settings"
            >
              <Settings size={15} /> Settings
            </Link>

            {user.isStaff && (
              <Link
                href="/admin"
                className="btn btn-ghost text-xs flex items-center gap-1.5 text-accent"
                title="Admin portal"
              >
                <Shield size={15} /> Admin
              </Link>
            )}

            <button onClick={handleLogout} className="btn btn-ghost text-xs flex items-center gap-1.5" title="Log out">
              <LogOut size={15} /> Logout
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {showGmailCta && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 text-sm px-6 py-3 flex flex-wrap items-center justify-between gap-3 max-w-[1400px] mx-auto w-full">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-blue-500 shrink-0" />
            <span>
              Gmail is connected as <span className="font-medium">{gmailStatus.email}</span> but no emails imported yet.
            </span>
          </div>
          <button
            onClick={handleGmailSync}
            disabled={syncingGmail}
            className="btn btn-primary text-xs disabled:opacity-70"
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
        <div className="bg-muted border-b border-border text-sm px-6 py-2 flex items-center justify-between max-w-[1400px] mx-auto w-full">
          <div>
            Showing messages from <span className="font-medium">{connectedAccounts.length}</span> connected account{connectedAccounts.length !== 1 ? 's' : ''}
            <Link href="/onboarding" className="ml-2 underline">Manage accounts</Link>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="max-w-[1400px] mx-auto w-full px-6 pt-4 pb-3 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[260px] relative">
          <div className="absolute left-4 top-3 text-muted-foreground">
            <Search size={17} />
          </div>
          <input
            ref={searchInputRef}
            id="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Semantic search: netflix, rent due, amazon order, $15...  (press /)"
            className="search-input pl-10"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAsk((v) => !v)}
            className={cn('btn', showAsk ? 'btn-primary' : 'btn-secondary')}
            title="Ask MsgNexus — semantic search over your messages"
          >
            Ask
          </button>
          <button
            onClick={() => setView('inbox')}
            className={cn('btn', view === 'inbox' ? 'btn-primary' : 'btn-secondary')}
          >
            <Inbox size={16} /> Inbox
          </button>
          <button
            onClick={() => setView('pulse')}
            className={cn('btn', view === 'pulse' ? 'btn-primary' : 'btn-secondary')}
          >
            <BarChart3 size={16} /> Pulse
          </button>
          <button onClick={resetFilters} className="btn btn-ghost text-xs">
            <Filter size={15} /> Reset filters
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={openAdd} className="btn btn-primary text-sm">
            <Plus size={16} /> Add message
          </button>
          <button onClick={runParseAllUnparsed} className="btn btn-secondary text-sm" disabled={unparsedCount === 0}>
            <Play size={16} /> Analyze
          </button>
          <button onClick={resetToSeeds} className="btn btn-ghost" title="Reset demo data">
            <RefreshCw size={16} />
          </button>
          <button onClick={exportData} className="btn btn-ghost" title="Export">
            <Download size={16} />
          </button>
          <label className="btn btn-ghost cursor-pointer" title="Import">
            <Upload size={16} />
            <input type="file" accept=".json" className="hidden" onChange={importData} disabled={isImporting} />
          </label>
          <button onClick={async () => {
            if (confirm('Clear all your data? This cannot be undone.')) {
              await resetUserData();
              setMessages([]);
              setInsights({});
              setSelectedMessageId(null);
              toast('Data cleared from database');
            }
          }} className="btn btn-ghost text-red-400" title="Clear your data">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {showAsk && (
        <div className="max-w-[1400px] mx-auto w-full px-6 pb-3">
          <div className="card p-4 space-y-3">
            <div className="text-sm font-medium">Ask MsgNexus</div>
            <p className="text-xs text-muted-foreground">
              Natural-language search over your messages — try &quot;netflix subscription&quot;, &quot;rent due&quot;, or &quot;amazon orders&quot;.
            </p>
            <input
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder="What are you looking for?"
              className="search-input"
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
                      className="w-full text-left rounded-xl border border-border p-3 hover:bg-muted/60 transition text-sm"
                    >
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground mb-1">
                        <span>{r.message.from}</span>
                        <span>{Math.round(r.score * 100)}% match</span>
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

      <div className="max-w-[1400px] mx-auto w-full flex-1 px-6 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-4">
            <div className="uppercase tracking-[1px] text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Users size={14} /> {connectedAccounts.length > 0 ? 'CONNECTED ACCOUNTS' : 'PLATFORMS'}
            </div>
            <div className="space-y-1">
              {connectedAccounts.length > 0 ? (
                // Show specific accounts when multiple per platform are connected
                connectedAccounts.map((acc) => {
                  const plat = getPlatform(acc.platformId);
                  const active = filters.platforms.has(acc.platformId);
                  const display = acc.label ? `${acc.identifier} (${acc.label})` : acc.identifier;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => togglePlatform(acc.platformId)}
                      className={cn(
                        'w-full flex justify-between items-center text-left px-3 py-1.5 rounded-xl text-sm transition',
                        active ? 'bg-muted' : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
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
                        'w-full flex justify-between items-center text-left px-3 py-1.5 rounded-xl text-sm transition',
                        active ? 'bg-muted' : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
                    </button>
                  );
                })
              )}
            </div>
            {connectedAccounts.length > 0 && (
              <Link href="/onboarding" className="text-xs block mt-3 text-accent hover:underline">+ Manage connected accounts</Link>
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
                    className={cn('filter-chip', active && 'active')}
                  >
                    {cat}
                    <span className="ml-1 opacity-60 tabular-nums">({categoryCounts[cat] || 0})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="lg:col-span-5 xl:col-span-6 flex flex-col">
          {view === 'inbox' ? (
            <>
              <div className="flex items-baseline justify-between mb-2 px-1 text-sm text-muted-foreground">
                {debouncedQuery ? `${ranked.length} semantic matches` : `${ranked.length} messages`}
              </div>

              <div className="panel flex-1 overflow-hidden">
                <div className="overflow-auto h-[calc(100vh-210px)] p-2 space-y-2">
                  {ranked.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      {isEmptyInbox ? (
                        <div className="space-y-4">
                          <Inbox size={40} className="mx-auto opacity-40" />
                          <div className="font-medium text-foreground">Your inbox is empty</div>
                          <p className="text-sm max-w-sm mx-auto">
                            Connect Gmail for real emails, add a message manually, or wait for demo data to load.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            {gmailStatus.configured && !gmailStatus.connected && (
                              <Link href="/settings" className="btn btn-primary text-sm">
                                <Mail size={15} /> Connect Gmail
                              </Link>
                            )}
                            {gmailStatus.connected && (
                              <button onClick={handleGmailSync} disabled={syncingGmail} className="btn btn-primary text-sm">
                                {syncingGmail ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                                Sync Gmail
                              </button>
                            )}
                            <button onClick={openAdd} className="btn btn-secondary text-sm">
                              <Plus size={15} /> Add message
                            </button>
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
                    const plat = getPlatform(message.platformId);
                    const isActive = selectedMessageId === message.id;
                    const preview = message.body.length > 140 ? message.body.slice(0, 137) + '...' : message.body;

                    return (
                      <div
                        key={message.id}
                        onClick={() => selectMessage(message.id)}
                        className={cn('message-card', isActive && 'active')}
                      >
                        <div className="flex items-start gap-3">
                          <div className="platform-badge text-white shrink-0 mt-0.5" style={{ backgroundColor: plat.color }}>
                            {plat.name}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{message.from}</span>
                              <span>•</span>
                              <span>{formatRelativeTime(message.timestamp)}</span>
                              {debouncedQuery && <span className="ml-auto text-[10px] px-1.5 py-px rounded bg-muted tabular-nums">{Math.round(score * 100)}% match</span>}
                            </div>
                            <div className="mt-1 text-sm leading-snug text-foreground whitespace-pre-wrap">
                              {message.subject && <span className="font-medium mr-1.5 text-muted-foreground">{message.subject}</span>}
                              {preview}
                            </div>

                            {insight && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <div className="insight-chip">{insight.category}</div>
                                {insight.vendor && <div className="insight-chip">{insight.vendor}</div>}
                                {insight.amount != null && (
                                  <div className="insight-chip font-medium">
                                    {formatCurrency(insight.amount, insight.currency)}
                                    {insight.isRecurring && <span className="text-[10px] ml-0.5 text-emerald-500">/mo</span>}
                                  </div>
                                )}
                              </div>
                            )}

                            {!insight && (
                              <button onClick={(e) => { e.stopPropagation(); runParse(message.id); }} className="mt-2 text-xs px-3 py-1 rounded-lg border border-border hover:bg-muted">
                                <Play size={13} className="inline mr-1" /> Run AI parse
                              </button>
                            )}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); deleteMessage(message.id); }} className="text-muted-foreground hover:text-red-500 p-1">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="pulse-card">
                  <div className="flex items-center gap-2 text-emerald-500 text-sm"><DollarSign size={16} /> MONTHLY RECURRING</div>
                  <div className="text-4xl font-semibold tabular-nums tracking-tighter mt-2">{formatCurrency(aggregates.monthlyRecurring)}</div>
                  <div className="text-xs text-muted-foreground mt-1">from {aggregates.subs.length} active subscriptions</div>
                </div>
                <div className="pulse-card">
                  <div className="flex items-center gap-2 text-amber-500 text-sm"><Calendar size={16} /> UPCOMING BILLS</div>
                  <div className="text-4xl font-semibold tabular-nums tracking-tighter mt-2">{formatCurrency(aggregates.totalUpcoming)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{aggregates.bills.length} bills detected</div>
                </div>
                <div className="pulse-card">
                  <div className="flex items-center gap-2 text-sky-500 text-sm"><BarChart3 size={16} /> PARSED MESSAGES</div>
                  <div className="text-4xl font-semibold tabular-nums tracking-tighter mt-2">{aggregates.totalParsed} / {aggregates.totalMessages}</div>
                </div>
              </div>

              <div className="pulse-card">
                <div className="font-semibold mb-3">Active Subscriptions</div>
                {aggregates.subs.length === 0 && <div className="text-sm text-muted-foreground">None detected yet.</div>}
                <div className="space-y-1">
                  {aggregates.subs.slice(0, 5).map(({ message, insight }) => (
                    <div key={message.id} onClick={() => { setView('inbox'); selectMessage(message.id); }} className="text-sm p-2 rounded-xl hover:bg-muted cursor-pointer flex justify-between">
                      <span>{insight?.vendor || message.from}</span>
                      <span className="text-emerald-500 tabular-nums">{formatCurrency(insight?.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={runParseAllUnparsed} className="btn btn-primary w-full">Re-analyze everything</button>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="panel h-full min-h-[420px] lg:sticky lg:top-20 p-5 flex flex-col">
            {!selectedMessage ? (
              <div className="flex flex-col items-center justify-center text-center flex-1 text-muted-foreground">
                <Inbox size={42} className="mb-4 opacity-50" />
                <div>Select a message to view details and run AI analysis.</div>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <div>
                    <div className="platform-badge text-white inline-block" style={{ backgroundColor: getPlatform(selectedMessage.platformId).color }}>
                      {getPlatform(selectedMessage.platformId).name}
                    </div>
                    <div className="font-semibold text-lg mt-1">{selectedMessage.from}</div>
                  </div>
                  <button onClick={() => setSelectedMessageId(null)}><X size={18} /></button>
                </div>

                <div className="divider my-4" />

                <div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/60 p-4 rounded-2xl border border-border">
                  {selectedMessage.body}
                </div>

                <div className="mt-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="uppercase text-xs tracking-widest text-muted-foreground">AI Insight</div>
                    <button onClick={() => runParse(selectedMessage.id)} className="text-xs text-accent flex items-center gap-1">
                      <Play size={13} /> Re-analyze
                    </button>
                  </div>

                  {selectedInsight ? (
                    <div className="card p-3 text-sm">
                      <div className="font-medium mb-1">{selectedInsight.summary}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        <span>Category: <span className="text-foreground">{selectedInsight.category}</span></span>
                        {selectedInsight.vendor && <span>Vendor: <span className="text-foreground">{selectedInsight.vendor}</span></span>}
                        {selectedInsight.amount != null && <span>Amount: <span className="text-emerald-500">{formatCurrency(selectedInsight.amount)}</span></span>}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => runParse(selectedMessage.id)} className="btn btn-primary w-full">Run AI Analysis</button>
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
                    <div className="flex gap-2">
                      <button onClick={() => deleteMessage(selectedMessage.id)} className="btn btn-secondary flex-1 text-red-500">Delete</button>
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
                        className="btn btn-primary flex-1 disabled:opacity-50"
                      >
                        {sendingSmsReply ? 'Sending…' : 'Reply via SMS'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => deleteMessage(selectedMessage.id)} className="btn btn-secondary flex-1 text-red-500">Delete</button>
                    {selectedMessage.platformId === 'sms' && !twilioSmsConnected && (
                      <Link href="/settings" className="btn btn-secondary flex-1 text-center">Connect SMS in Settings</Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add modal (simplified) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6" onClick={() => setIsAddOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="font-semibold text-lg mb-1">Add simulated message</div>
            <div className="space-y-4 mt-4">
              <select value={addForm.platformId} onChange={e => setAddForm(f => ({...f, platformId: e.target.value as PlatformId}))} className="w-full bg-input border border-input-border rounded-2xl px-3 py-2 text-sm">
                {availablePlatforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={addForm.from} onChange={e => setAddForm(f => ({...f, from: e.target.value}))} placeholder="From" className="w-full bg-input border border-input-border rounded-2xl px-3 py-2 text-sm" />
              <textarea value={addForm.body} onChange={e => setAddForm(f => ({...f, body: e.target.value}))} rows={4} placeholder="Message content..." className="w-full bg-input border border-input-border rounded-2xl px-3 py-2 text-sm font-mono" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsAddOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={submitAddMessage} className="btn btn-primary flex-1">Add &amp; Analyze</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
