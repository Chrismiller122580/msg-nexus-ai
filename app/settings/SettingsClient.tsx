'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Mail, RefreshCw, Unplug, Loader2, Smartphone,
  Hash, MessageCircle, Send, AtSign, Shield, CreditCard, Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { MsgNexusLogo } from '@/app/components/MsgNexusLogo';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';
import { getCurrentUserAction } from '@/app/actions/user';
import { disconnectGmailAction, getGmailStatus, syncGmailAction } from '@/app/actions/gmail';
import { disconnectOutlookAction, getOutlookStatus, syncOutlookAction } from '@/app/actions/outlook';
import { connectTwilioAction, disconnectTwilioAction, getTwilioStatus, syncTwilioAction } from '@/app/actions/twilio';
import { syncAllIntegrationsAction } from '@/app/actions/integrations';
import { getBillingStatus, startCheckoutAction, openBillingPortalAction } from '@/app/actions/billing';
import {
  getAllPlatformStatuses,
  disconnectSlackAction, disconnectDiscordAction, disconnectTelegramAction,
  disconnectWhatsAppAction, disconnectXAction,
  syncSlackAction, syncDiscordAction, syncTelegramAction,
  syncWhatsAppAction, syncXAction,
  startTelegramLinkAction, connectWhatsAppAction,
} from '@/app/actions/platforms';
import {
  getPushStatus,
  subscribePushAction,
  unsubscribePushAction,
  sendTestPushAction,
} from '@/app/actions/push';

type ConnectionItem = {
  id: number;
  identifier: string;
  lastSyncedAt?: string;
  connectedAt?: string;
};

type Status = {
  configured: boolean;
  connected: boolean;
  identifier?: string;
  linkCode?: string;
  lastSyncedAt?: string;
  serverPhone?: string;
  connections?: ConnectionItem[];
};

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [userEmail, setUserEmail] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [billing, setBilling] = useState<{
    configured: boolean; plan: string; status: string;
    currentPeriodEnd?: string; hasStripeCustomer: boolean;
  }>({ configured: false, plan: 'free', status: 'active', hasStripeCustomer: false });
  const [smsPhone, setSmsPhone] = useState('');
  const [testSmsSending, setTestSmsSending] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  const [gmail, setGmail] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [outlook, setOutlook] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [twilio, setTwilio] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [slack, setSlack] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [discord, setDiscord] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [telegram, setTelegram] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [whatsapp, setWhatsapp] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [xPlatform, setXPlatform] = useState<Status>({ configured: false, connected: false, connections: [] });
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  async function reload() {
    const [g, o, t, p] = await Promise.all([getGmailStatus(), getOutlookStatus(), getTwilioStatus(), getAllPlatformStatuses()]);
    setGmail({
      configured: g.configured,
      connected: g.connected,
      identifier: g.identifier ?? g.email,
      lastSyncedAt: g.lastSyncedAt,
      connections: g.connections ?? [],
    });
    setOutlook({
      configured: o.configured,
      connected: o.connected,
      identifier: o.identifier ?? o.email,
      lastSyncedAt: o.lastSyncedAt,
      connections: o.connections ?? [],
    });
    setTwilio({
      configured: t.configured,
      connected: t.connected,
      identifier: t.identifier ?? t.phoneNumber,
      lastSyncedAt: t.lastSyncedAt,
      serverPhone: t.serverPhone,
      connections: t.connections ?? [],
    });
    setSlack(p.slack);
    setDiscord(p.discord);
    setTelegram(p.telegram);
    setWhatsapp(p.whatsapp);
    setXPlatform(p.x);
    if (p.telegram.linkCode) setTelegramCode(p.telegram.linkCode);
    try {
      const push = await getPushStatus();
      setPushConfigured(push.configured);
      setPushPublicKey(push.publicKey);
      setPushSubscribed(push.subscribed);
    } catch {
      /* optional */
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUserAction();
        if (!user) { router.replace('/login?redirect=/settings'); return; }
        setUserEmail(user.email);
        setIsStaff(user.isStaff);
        const b = await getBillingStatus();
        setBilling(b);
        await reload();
      } catch {
        router.replace('/login?redirect=/settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  useEffect(() => {
    const connected = ['gmail', 'outlook', 'slack', 'discord', 'telegram', 'whatsapp', 'x'];
    for (const key of connected) {
      if (searchParams.get(key) === 'connected') {
        // Gmail/Outlook may include a more specific imported/error toast below
        const hasSpecific =
          (key === 'gmail' &&
            (searchParams.get('imported') || searchParams.get('error') === 'gmail-sync-failed')) ||
          (key === 'outlook' &&
            (searchParams.get('imported') || searchParams.get('error') === 'outlook-sync-failed'));
        if (!hasSpecific) {
          toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} connected`);
        }
        reload();
      }
    }
    const errors: Record<string, string> = {
      'gmail-not-configured': 'Gmail OAuth not configured',
      'gmail-auth-failed': 'Gmail authorization failed',
      'gmail-sync-failed': 'Gmail connected, but import failed',
      'outlook-not-configured': 'Outlook OAuth not configured',
      'outlook-auth-failed': 'Outlook authorization failed',
      'outlook-sync-failed': 'Outlook connected, but import failed',
      'slack-not-configured': 'Slack OAuth not configured',
      'slack-auth-failed': 'Slack authorization failed',
      'discord-not-configured': 'Discord OAuth not configured',
      'discord-auth-failed': 'Discord authorization failed',
      'x-not-configured': 'X OAuth not configured',
      'x-auth-failed': 'X authorization failed',
    };
    const err = searchParams.get('error');
    const detail = searchParams.get('detail');
    if (err && errors[err]) {
      toast.error(detail ? `${errors[err]}: ${detail}` : errors[err], { duration: 10000 });
    }
    const imported = searchParams.get('imported');
    if (imported && searchParams.get('gmail') === 'connected') {
      toast.success(`Gmail connected — imported ${imported} email${imported === '1' ? '' : 's'}`);
    }
    if (imported && searchParams.get('outlook') === 'connected') {
      toast.success(`Outlook connected — imported ${imported} email${imported === '1' ? '' : 's'}`);
    }
    if (searchParams.get('billing') === 'success') toast.success('Subscription updated');
    if (searchParams.get('billing') === 'cancelled') toast.info('Checkout cancelled');
  }, [searchParams]);

  async function runSync(key: string, fn: () => Promise<{ error?: string; info?: string; imported?: number }>) {
    setSyncing((s) => ({ ...s, [key]: true }));
    try {
      const r = await fn();
      if (r.error) toast.error(r.error, { duration: 8000 });
      else if (r.info && (r.imported ?? 0) === 0) toast.info(r.info, { duration: 10000 });
      else toast.success(`Imported ${r.imported ?? 0} messages${r.info ? ` — ${r.info}` : ''}`);
      await reload();
    } finally {
      setSyncing((s) => ({ ...s, [key]: false }));
    }
  }

  if (loading) return <LoadingSpinner message="Loading settings..." />;

  const webhookBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b border-border px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between max-w-3xl mx-auto w-full safe-area-top">
        <MsgNexusLogo href="/dashboard" />
        <div className="flex items-center gap-1 sm:gap-2">
          {isStaff && (
            <Link href="/admin" className="btn btn-ghost text-xs flex items-center gap-1.5 text-accent min-h-[44px] min-w-[44px] px-2 sm:px-4">
              <Shield size={15} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 sm:mb-8 min-h-[44px]">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        {searchParams.get('welcome') === '1' && (
          <div className="card p-4 sm:p-5 mb-6 sm:mb-8 border-accent/30 bg-accent/5">
            <h2 className="font-semibold mb-1">Welcome to MsgNexus</h2>
            <p className="text-sm text-muted-foreground">
              Connect the apps you use below. Once connected, sync to pull messages into your unified inbox.
            </p>
          </div>
        )}

        <div id="notifications" className="card p-4 sm:p-6 space-y-3 mb-6 sm:mb-8 scroll-mt-20">
          <div className="flex items-center gap-2">
            <Bell className="text-indigo-500" size={18} />
            <h2 className="font-semibold">Push notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Get browser alerts when SMS, WhatsApp, or Telegram messages arrive. Works best when the app is installed as a PWA.
          </p>
          {!pushConfigured && (
            <p className="text-xs text-amber-600">
              Server needs <code className="text-[11px]">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> and{' '}
              <code className="text-[11px]">VAPID_PRIVATE_KEY</code>.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!pushSubscribed ? (
              <button
                type="button"
                disabled={!pushConfigured || pushBusy}
                className="btn btn-primary text-sm disabled:opacity-50"
                onClick={async () => {
                  setPushBusy(true);
                  try {
                    if (!pushPublicKey) {
                      toast.error('VAPID public key missing');
                      return;
                    }
                    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
                      toast.error('This browser does not support web push');
                      return;
                    }
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') {
                      toast.error('Notification permission denied');
                      return;
                    }
                    const reg = await navigator.serviceWorker.ready;
                    const sub = await reg.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: urlBase64ToUint8Array(pushPublicKey),
                    });
                    const json = sub.toJSON();
                    const r = await subscribePushAction({
                      endpoint: json.endpoint!,
                      keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
                      userAgent: navigator.userAgent,
                    });
                    if (r.error) toast.error(r.error);
                    else {
                      toast.success('Push enabled on this device');
                      setPushSubscribed(true);
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed to enable push');
                  } finally {
                    setPushBusy(false);
                  }
                }}
              >
                {pushBusy ? 'Enabling…' : 'Enable push'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pushBusy}
                  className="btn btn-secondary text-sm"
                  onClick={async () => {
                    setPushBusy(true);
                    try {
                      const r = await sendTestPushAction();
                      if (r.error) toast.error(r.error);
                      else toast.success('Test notification sent');
                    } finally {
                      setPushBusy(false);
                    }
                  }}
                >
                  Send test
                </button>
                <button
                  type="button"
                  disabled={pushBusy}
                  className="btn btn-secondary text-sm"
                  onClick={async () => {
                    setPushBusy(true);
                    try {
                      const reg = await navigator.serviceWorker.ready;
                      const sub = await reg.pushManager.getSubscription();
                      if (sub) await sub.unsubscribe();
                      const r = await unsubscribePushAction(sub?.endpoint);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success('Push disabled');
                        setPushSubscribed(false);
                      }
                    } finally {
                      setPushBusy(false);
                    }
                  }}
                >
                  Disable
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">Integrations</h1>
            <p className="text-muted-foreground text-sm sm:text-base break-words">Connect your messaging apps · {userEmail}</p>
          </div>
          <button onClick={async () => {
            setSyncingAll(true);
            try {
              const r = await syncAllIntegrationsAction();
              if (r.error) toast.error(r.error);
              else {
                const lines = r.details
                  ? Object.entries(r.details)
                      .filter(([, v]) => (v.imported ?? 0) > 0 || v.error || v.info)
                      .map(([k, v]) => {
                        if (v.error) return `${k}: ${v.error}`;
                        if (v.info && !v.imported) return `${k}: ${v.info}`;
                        return `${k}: +${v.imported}`;
                      })
                  : [];
                toast.success(
                  `Synced all — ${r.totalImported ?? 0} new messages`,
                  lines.length ? { description: lines.join(' · ') } : undefined
                );
              }
              await reload();
            } finally { setSyncingAll(false); }
          }} disabled={syncingAll} className="btn btn-primary text-sm disabled:opacity-70 min-h-[44px] w-full sm:w-auto shrink-0">
            {syncingAll ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync all</>}
          </button>
        </div>

        <div className="card p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold flex items-center gap-2"><CreditCard size={18} /> Billing</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Current plan: <span className="capitalize font-medium text-foreground">{billing.plan}</span>
                {billing.status !== 'active' && <span className="text-amber-500"> ({billing.status})</span>}
              </p>
              {billing.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-1">Renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {billing.configured ? (
                <>
                  {billing.plan !== 'pro' && (
                    <button onClick={async () => {
                      const r = await startCheckoutAction('pro');
                      if (r.error) toast.error(r.error);
                      else if (r.url) window.location.href = r.url;
                    }} className="btn btn-primary text-xs">Upgrade to Pro</button>
                  )}
                  {billing.plan !== 'enterprise' && (
                    <button onClick={async () => {
                      const r = await startCheckoutAction('enterprise');
                      if (r.error) toast.error(r.error);
                      else if (r.url) window.location.href = r.url;
                    }} className="btn btn-secondary text-xs">Enterprise</button>
                  )}
                  {billing.hasStripeCustomer && (
                    <button onClick={async () => {
                      const r = await openBillingPortalAction();
                      if (r.error) toast.error(r.error);
                      else if (r.url) window.location.href = r.url;
                    }} className="btn btn-ghost text-xs">Manage billing</button>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO to enable</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <OAuthCard icon={<Mail className="text-blue-500" size={20} />} title="Gmail" hint="GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
            callbackPath="/api/auth/gmail/callback" oauthProviderLabel="Google Cloud Console"
            oauthInfoKey="gmail"
            status={gmail} connectHref="/api/auth/gmail" onSync={() => runSync('gmail', syncGmailAction)}
            syncing={syncing.gmail} onDisconnect={async (id) => { await disconnectGmailAction(id); await reload(); toast.success('Disconnected'); }} />

          <OAuthCard icon={<Mail className="text-sky-500" size={20} />} title="Outlook" hint="MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET"
            callbackPath="/api/auth/microsoft/callback" oauthProviderLabel="Azure Portal → App registration → Redirect URIs"
            oauthInfoKey="outlook"
            status={outlook} connectHref="/api/auth/microsoft" onSync={() => runSync('outlook', syncOutlookAction)}
            syncing={syncing.outlook} onDisconnect={async (id) => { await disconnectOutlookAction(id); await reload(); toast.success('Disconnected'); }}
            extraHelp={
              <div className="text-xs text-muted-foreground space-y-1.5 rounded-xl border border-border p-3">
                <p className="font-medium text-foreground">Azure setup checklist</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Redirect URI (Web) must match server exactly:{' '}
                    <code className="bg-muted px-1 rounded break-all">
                      https://www.msgnexus.ai/api/auth/microsoft/callback
                    </code>
                  </li>
                  <li>
                    Also add Codespace/local if testing there:{' '}
                    <code className="bg-muted px-1 rounded break-all">
                      {webhookBase}/api/auth/microsoft/callback
                    </code>
                  </li>
                  <li>
                    Supported account types: <strong>Accounts in any org + personal Microsoft accounts</strong>{' '}
                    (or personal only with <code className="bg-muted px-1 rounded">MICROSOFT_TENANT_ID=consumers</code>).
                  </li>
                  <li>
                    API permissions (delegated): <code className="bg-muted px-1 rounded">Mail.Read</code>,{' '}
                    <code className="bg-muted px-1 rounded">User.Read</code>,{' '}
                    <code className="bg-muted px-1 rounded">offline_access</code>,{' '}
                    <code className="bg-muted px-1 rounded">openid</code>,{' '}
                    <code className="bg-muted px-1 rounded">profile</code>,{' '}
                    <code className="bg-muted px-1 rounded">email</code>.
                  </li>
                  <li>Work/school: admin may need to grant consent once.</li>
                  <li>Personal Hotmail/Outlook.com: sign in with that Microsoft account (not a work admin).</li>
                </ul>
              </div>
            }
          />

          <OAuthCard icon={<Hash className="text-purple-500" size={20} />} title="Slack" hint="SLACK_CLIENT_ID, SLACK_CLIENT_SECRET"
            callbackPath="/api/auth/slack/callback" oauthProviderLabel="api.slack.com → Your App → OAuth & Permissions"
            oauthInfoKey="slack"
            status={slack} connectHref="/api/auth/slack" onSync={() => runSync('slack', syncSlackAction)}
            syncing={syncing.slack} onDisconnect={async (id) => { await disconnectSlackAction(id); await reload(); toast.success('Disconnected'); }} />

          <OAuthCard icon={<MessageCircle className="text-indigo-500" size={20} />} title="Discord" hint="DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET"
            callbackPath="/api/auth/discord/callback" oauthProviderLabel="Discord Developer Portal → OAuth2 → Redirects"
            oauthInfoKey="discord"
            status={discord} connectHref="/api/auth/discord" onSync={() => runSync('discord', syncDiscordAction)}
            syncing={syncing.discord} onDisconnect={async (id) => { await disconnectDiscordAction(id); await reload(); toast.success('Disconnected'); }} />

          <OAuthCard icon={<AtSign className="text-foreground" size={20} />} title="X / Twitter" hint="X_CLIENT_ID, X_CLIENT_SECRET"
            callbackPath="/api/auth/x/callback" oauthProviderLabel="developer.x.com → User authentication settings"
            oauthInfoKey="x"
            status={xPlatform} connectHref="/api/auth/x" onSync={() => runSync('x', syncXAction)}
            syncing={syncing.x} onDisconnect={async (id) => { await disconnectXAction(id); await reload(); toast.success('Disconnected'); }} />

          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                <Smartphone className="text-emerald-500" size={20} />
              </div>
              <div>
                <h2 className="font-semibold">SMS (Twilio)</h2>
                <p className="text-sm text-muted-foreground">Connect the server Twilio line for history sync, webhooks, and send</p>
              </div>
            </div>
            {!twilio.configured && (
              <p className="text-sm text-amber-600">Server needs <code className="text-xs">TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER</code></p>
            )}
            {twilio.connected ? (
              <>
                <MultiConnectionPanel
                  title="SMS"
                  connections={twilio.connections}
                  fallbackIdentifier={twilio.identifier}
                  fallbackLastSyncedAt={twilio.lastSyncedAt}
                  onSync={() => runSync('twilio', syncTwilioAction)}
                  syncing={syncing.twilio}
                  onDisconnect={async (id) => { await disconnectTwilioAction(id); await reload(); toast.success('Disconnected'); }}
                />
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground">Add another SMS number (E.164)</p>
                  <input
                    type="tel"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="+15551234567"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        const r = await connectTwilioAction(smsPhone || undefined);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success(`SMS connected${r.phoneNumber ? ` as ${r.phoneNumber}` : ''}`);
                          setSmsPhone('');
                          await reload();
                          await runSync('twilio', syncTwilioAction);
                        }
                      }}
                      disabled={!twilio.configured}
                      className="btn btn-secondary text-sm disabled:opacity-50"
                    >
                      Add number
                    </button>
                    <button
                      disabled={testSmsSending || !twilio.configured || !smsPhone.trim()}
                      onClick={async () => {
                        const to = smsPhone.trim();
                        if (!to) { toast.error('Enter a personal phone to receive the test'); return; }
                        setTestSmsSending(true);
                        try {
                          const res = await fetch('/api/sms/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ to, message: 'Hello from MsgNexus! 📱' }),
                          });
                          const text = await res.text();
                          const data = text ? JSON.parse(text) : {};
                          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                          toast.success('SMS sent — syncing…');
                          await runSync('twilio', syncTwilioAction);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Send failed');
                        } finally {
                          setTestSmsSending(false);
                        }
                      }}
                      className="btn btn-secondary text-sm disabled:opacity-50"
                    >
                      {testSmsSending ? <><Loader2 className="animate-spin" size={14} /> Sending…</> : <>📨 Send Test SMS</>}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Connect a Twilio line (defaults to <code className="bg-muted px-1 rounded">TWILIO_PHONE_NUMBER</code>
                  {twilio.serverPhone ? <> = <code className="bg-muted px-1 rounded">{twilio.serverPhone}</code></> : null}
                  ). You can add more numbers later.
                </p>
                <input type="tel" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="+15551234567 (optional if env set)"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" disabled={!twilio.configured} />
                <button
                  onClick={async () => {
                    const r = await connectTwilioAction(smsPhone || undefined);
                    if (r.error) toast.error(r.error);
                    else {
                      toast.success(`SMS connected${r.phoneNumber ? ` as ${r.phoneNumber}` : ''}`);
                      await reload();
                      await runSync('twilio', syncTwilioAction);
                    }
                  }}
                  disabled={!twilio.configured}
                  className="btn btn-primary text-sm disabled:opacity-50"
                >
                  Connect SMS (Twilio)
                </button>
              </div>
            )}
            {twilio.configured && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Webhook (Twilio Console → Phone Number → A message comes in):</p>
                <code className="block break-all bg-muted p-2 rounded-lg">{webhookBase}/api/webhooks/twilio</code>
              </div>
            )}
          </div>

          <PhoneCard icon={<Send className="text-green-600" size={20} />} title="WhatsApp" hint="WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID"
            status={whatsapp} phone={waPhone} setPhone={setWaPhone}
            onConnect={async () => {
              const r = await connectWhatsAppAction(waPhone || undefined);
              if (r.error) toast.error(r.error, { duration: 10000 });
              else {
                toast.success(r.info || 'WhatsApp connected', { duration: 10000 });
                await reload();
                await runSync('whatsapp', syncWhatsAppAction);
              }
            }}
            onSync={() => runSync('whatsapp', syncWhatsAppAction)} syncing={syncing.whatsapp}
            onDisconnect={async (id) => { await disconnectWhatsAppAction(id); await reload(); toast.success('Disconnected'); }}
            webhookUrl={`${webhookBase}/api/webhooks/whatsapp`}
            extraNote="WhatsApp has no history API — Sync will not pull old chats. In Meta Developer → WhatsApp → Configuration, set Callback URL to the webhook below, Verify token = WHATSAPP_VERIFY_TOKEN, subscribe to messages, then text your Business number."
          />

          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                <Send className="text-cyan-500" size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Telegram</h2>
                <p className="text-sm text-muted-foreground">Link via bot · multiple chats OK</p>
              </div>
            </div>
            {!telegram.configured && <p className="text-sm text-amber-600">Server needs TELEGRAM_BOT_TOKEN (+ TELEGRAM_BOT_USERNAME).</p>}
            {telegram.connected && (
              <MultiConnectionPanel
                title="Telegram"
                connections={telegram.connections}
                fallbackIdentifier={telegram.identifier}
                fallbackLastSyncedAt={telegram.lastSyncedAt}
                onSync={() => runSync('telegram', syncTelegramAction)}
                syncing={syncing.telegram}
                onDisconnect={async (id) => { await disconnectTelegramAction(id); await reload(); toast.success('Disconnected'); }}
              />
            )}
            <div className="space-y-3">
              <button disabled={!telegram.configured} onClick={async () => {
                const r = await startTelegramLinkAction();
                if (r.error) toast.error(r.error);
                else if (r.linkCode) {
                  setTelegramCode(r.linkCode);
                  toast.success(`Send /link ${r.linkCode} to @${r.botUsername} on Telegram`);
                }
              }} className="btn btn-primary text-sm disabled:opacity-50">
                {telegram.connected ? 'Link another chat' : 'Generate link code'}
              </button>
              {telegramCode && (
                <p className="text-sm">Send to bot: <code className="bg-muted px-2 py-1 rounded">/link {telegramCode}</code></p>
              )}
            </div>
            {telegram.configured && (
              <p className="text-xs text-muted-foreground">Webhook: <code className="break-all">{webhookBase}/api/webhooks/telegram</code></p>
            )}
          </div>

          <div className="card p-6 border-dashed opacity-70">
            <h2 className="font-semibold mb-1">iMessage</h2>
            <p className="text-sm text-muted-foreground">Coming soon — requires a Mac relay (BlueBubbles / AirMessage).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OAuthCard({ icon, title, hint, status, connectHref, onSync, syncing, onDisconnect, callbackPath, oauthProviderLabel, oauthInfoKey, extraHelp }: {
  icon: ReactNode; title: string; hint: string; status: Status;
  connectHref: string; onSync: () => void; syncing?: boolean;
  onDisconnect: (connectionId?: number) => void;
  callbackPath?: string; oauthProviderLabel?: string; oauthInfoKey?: string; extraHelp?: ReactNode;
}) {
  const [callbackUrl, setCallbackUrl] = useState('');
  const [redirectUris, setRedirectUris] = useState<string[]>([]);
  const [jsOrigins, setJsOrigins] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadCallback() {
      // Prefer the server OAuth callback (from NEXT_PUBLIC_APP_URL) over window.origin —
      // they can differ (www vs apex, Codespace URL, etc.) and only the server value is sent to Google.
      if (oauthInfoKey) {
        try {
          const res = await fetch('/api/auth/oauth-info');
          if (res.ok) {
            const data = await res.json() as {
              googleCloudConsole?: { authorizedRedirectUris?: string[]; authorizedJavaScriptOrigins?: string[] };
              integrations?: Record<string, { callbackUrl?: string }>;
            };
            const serverCallback = data.integrations?.[oauthInfoKey]?.callbackUrl;
            if (!cancelled && serverCallback) {
              setCallbackUrl(serverCallback);
              if (oauthInfoKey === 'gmail') {
                setRedirectUris(data.googleCloudConsole?.authorizedRedirectUris ?? [serverCallback]);
                setJsOrigins(data.googleCloudConsole?.authorizedJavaScriptOrigins ?? []);
              }
              return;
            }
          }
        } catch {
          /* fall through to window.origin */
        }
      }
      if (!cancelled && callbackPath && typeof window !== 'undefined') {
        setCallbackUrl(`${window.location.origin}${callbackPath}`);
      }
    }
    loadCallback();
    return () => { cancelled = true; };
  }, [callbackPath, oauthInfoKey]);

  const urisToShow = redirectUris.length > 0 ? redirectUris : (callbackUrl ? [callbackUrl] : []);

  return (
    <div className="card p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0"><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">OAuth connect + sync</p></div>
      </div>
      {!status.configured && <p className="text-sm text-amber-600">Server needs <code className="text-xs">{hint}</code></p>}
      {urisToShow.length > 0 && oauthProviderLabel && (
        <details className="text-xs text-muted-foreground rounded-xl border border-border p-3" open={!status.connected && status.configured && title === 'Gmail'}>
          <summary className="cursor-pointer font-medium text-foreground">
            {status.configured ? 'Fix Error 400 / redirect_uri_mismatch' : 'Setup: redirect URI'}
          </summary>
          <p className="mt-2">
            Google <strong>Error 400: redirect_uri_mismatch</strong> means one of these URIs is missing
            from {oauthProviderLabel}. Open your <strong>Web application</strong> client (same as{' '}
            <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_ID</code>) and add <strong>every</strong> line exactly:
          </p>
          <ul className="mt-2 space-y-1.5">
            {urisToShow.map((uri) => (
              <li key={uri}>
                <code className="block break-all bg-muted p-2 rounded-lg text-[11px] select-all font-mono">{uri}</code>
              </li>
            ))}
          </ul>
          {jsOrigins.length > 0 && (
            <p className="mt-2">
              Authorized JavaScript origins:{' '}
              {jsOrigins.map((o) => (
                <code key={o} className="bg-muted px-1 rounded mr-1 break-all">{o}</code>
              ))}
            </p>
          )}
          {jsOrigins.length === 0 && (
            <p className="mt-2">
              Also add JavaScript origin:{' '}
              <code className="bg-muted px-1 rounded">
                {typeof window !== 'undefined' ? window.location.origin : 'https://www.msgnexus.ai'}
              </code>
            </p>
          )}
          <p className="mt-1">Click <strong>Save</strong>, wait 1–2 minutes, then try Connect again.</p>
          {title === 'Gmail' && (
            <div className="mt-3 pt-3 border-t border-border space-y-1.5">
              <p className="font-medium text-foreground">Error 403: access_denied</p>
              <p>
                The OAuth consent screen is in <strong>Testing</strong> mode. Only listed test users can connect.
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Open{' '}
                  <a
                    className="underline"
                    href="https://console.cloud.google.com/apis/credentials/consent"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OAuth consent screen
                  </a>
                </li>
                <li>Under <strong>Test users</strong>, add the exact Google account you sign in with</li>
                <li>
                  Enable{' '}
                  <a
                    className="underline"
                    href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Gmail API
                  </a>{' '}
                  for this project
                </li>
                <li>Save, wait ~1 minute, try Connect again (use an Incognito window if Google cached the error)</li>
              </ol>
            </div>
          )}
          <p className="mt-1 text-[11px]">
            Live check: <a className="underline" href="/api/auth/oauth-info" target="_blank" rel="noreferrer">/api/auth/oauth-info</a>
          </p>
        </details>
      )}
      {extraHelp}
      {status.connected ? (
        <MultiConnectionPanel
          title={title}
          connections={status.connections}
          fallbackIdentifier={status.identifier}
          fallbackLastSyncedAt={status.lastSyncedAt}
          onSync={onSync}
          syncing={syncing}
          onDisconnect={onDisconnect}
          addHref={status.configured ? connectHref : undefined}
          addLabel={`Add another ${title}`}
        />
      ) : (
        <a href={status.configured ? connectHref : '#'} className={`btn btn-primary text-sm inline-flex ${!status.configured ? 'opacity-50 pointer-events-none' : ''}`}>
          Connect {title}
        </a>
      )}
    </div>
  );
}

function PhoneCard({ icon, title, hint, status, phone, setPhone, onConnect, onSync, syncing, onDisconnect, webhookUrl, extraNote }: {
  icon: ReactNode; title: string; hint: string; status: Status;
  phone: string; setPhone: (v: string) => void;
  onConnect: () => void; onSync: () => void; syncing?: boolean;
  onDisconnect: (connectionId?: number) => void; webhookUrl: string;
  extraNote?: string;
}) {
  return (
    <div className="card p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0"><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Phone + webhook · multiple numbers OK</p></div>
      </div>
      {!status.configured && <p className="text-sm text-amber-600">Server needs <code className="text-xs">{hint}</code></p>}
      {status.connected ? (
        <>
          <MultiConnectionPanel
            title={title}
            connections={status.connections}
            fallbackIdentifier={status.identifier}
            fallbackLastSyncedAt={status.lastSyncedAt}
            onSync={onSync}
            syncing={syncing}
            onDisconnect={onDisconnect}
          />
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">Add another number</p>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" disabled={!status.configured} />
            <button onClick={onConnect} disabled={!status.configured} className="btn btn-secondary text-sm disabled:opacity-50">
              Add {title} number
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567 (optional)"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" disabled={!status.configured} />
          <button onClick={onConnect} disabled={!status.configured} className="btn btn-primary text-sm disabled:opacity-50">Connect {title}</button>
        </div>
      )}
      {status.configured && <p className="text-xs text-muted-foreground">Webhook: <code className="break-all">{webhookUrl}</code></p>}
      {extraNote && <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">{extraNote}</p>}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function MultiConnectionPanel({
  title,
  connections,
  fallbackIdentifier,
  fallbackLastSyncedAt,
  onSync,
  syncing,
  onDisconnect,
  addHref,
  addLabel,
}: {
  title: string;
  connections?: ConnectionItem[];
  fallbackIdentifier?: string;
  fallbackLastSyncedAt?: string;
  onSync: () => void;
  syncing?: boolean;
  onDisconnect: (connectionId?: number) => void;
  addHref?: string;
  addLabel?: string;
}) {
  const list =
    connections && connections.length > 0
      ? connections
      : fallbackIdentifier
        ? [{ id: 0, identifier: fallbackIdentifier, lastSyncedAt: fallbackLastSyncedAt }]
        : [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {list.length} {title} connection{list.length === 1 ? '' : 's'} — add more anytime.
      </p>
      <ul className="space-y-2">
        {list.map((c) => (
          <li
            key={c.id || c.identifier}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{c.identifier}</div>
              {c.lastSyncedAt && (
                <div className="text-[11px] text-muted-foreground">
                  Last sync {new Date(c.lastSyncedAt).toLocaleString()}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDisconnect(c.id || undefined)}
              className="btn btn-secondary text-xs shrink-0"
            >
              <Unplug size={14} /> Disconnect
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button onClick={onSync} disabled={syncing} className="btn btn-primary text-sm disabled:opacity-70">
          {syncing ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync all</>}
        </button>
        {addHref && (
          <a href={addHref} className="btn btn-secondary text-sm inline-flex">
            {addLabel || 'Add another'}
          </a>
        )}
      </div>
    </div>
  );
}