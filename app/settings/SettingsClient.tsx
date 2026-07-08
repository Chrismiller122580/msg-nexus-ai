'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Mail, RefreshCw, Unplug, Loader2, Smartphone,
  Hash, MessageCircle, Send, AtSign, Shield, CreditCard,
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

type Status = { configured: boolean; connected: boolean; identifier?: string; linkCode?: string; lastSyncedAt?: string };

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
  const [gmail, setGmail] = useState<Status>({ configured: false, connected: false });
  const [outlook, setOutlook] = useState<Status>({ configured: false, connected: false });
  const [twilio, setTwilio] = useState<Status>({ configured: false, connected: false });
  const [slack, setSlack] = useState<Status>({ configured: false, connected: false });
  const [discord, setDiscord] = useState<Status>({ configured: false, connected: false });
  const [telegram, setTelegram] = useState<Status>({ configured: false, connected: false });
  const [whatsapp, setWhatsapp] = useState<Status>({ configured: false, connected: false });
  const [xPlatform, setXPlatform] = useState<Status>({ configured: false, connected: false });

  async function reload() {
    const [g, o, t, p] = await Promise.all([getGmailStatus(), getOutlookStatus(), getTwilioStatus(), getAllPlatformStatuses()]);
    setGmail(g);
    setOutlook(o);
    setTwilio({ ...t, identifier: t.phoneNumber });
    setSlack(p.slack);
    setDiscord(p.discord);
    setTelegram(p.telegram);
    setWhatsapp(p.whatsapp);
    setXPlatform(p.x);
    if (t.connected && 'phoneNumber' in t) setSmsPhone((t as { phoneNumber?: string }).phoneNumber || '');
    if (p.whatsapp.identifier) setWaPhone(p.whatsapp.identifier);
    if (p.telegram.linkCode) setTelegramCode(p.telegram.linkCode);
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
        toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} connected`);
        reload();
      }
    }
    const errors: Record<string, string> = {
      'gmail-not-configured': 'Gmail OAuth not configured',
      'gmail-auth-failed': 'Gmail authorization failed',
      'outlook-not-configured': 'Outlook OAuth not configured',
      'outlook-auth-failed': 'Outlook authorization failed',
      'slack-not-configured': 'Slack OAuth not configured',
      'slack-auth-failed': 'Slack authorization failed',
      'discord-not-configured': 'Discord OAuth not configured',
      'discord-auth-failed': 'Discord authorization failed',
      'x-not-configured': 'X OAuth not configured',
      'x-auth-failed': 'X authorization failed',
    };
    const err = searchParams.get('error');
    if (err && errors[err]) toast.error(errors[err]);
    if (searchParams.get('billing') === 'success') toast.success('Subscription updated');
    if (searchParams.get('billing') === 'cancelled') toast.info('Checkout cancelled');
  }, [searchParams]);

  async function runSync(key: string, fn: () => Promise<{ error?: string; info?: string; imported?: number }>) {
    setSyncing((s) => ({ ...s, [key]: true }));
    try {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else if (r.info && (r.imported ?? 0) === 0) toast.info(r.info);
      else toast.success(`Imported ${r.imported ?? 0} messages${r.info ? ` — ${r.info}` : ''}`);
      await reload();
    } finally {
      setSyncing((s) => ({ ...s, [key]: false }));
    }
  }

  if (loading) return <LoadingSpinner message="Loading settings..." />;

  const webhookBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 h-16 flex items-center justify-between max-w-3xl mx-auto w-full">
        <MsgNexusLogo href="/inbox" />
        <div className="flex items-center gap-2">
          {isStaff && (
            <Link href="/admin" className="btn btn-ghost text-xs flex items-center gap-1.5 text-accent">
              <Shield size={15} /> Admin
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/inbox" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={16} /> Back to inbox
        </Link>

        {searchParams.get('welcome') === '1' && (
          <div className="card p-5 mb-8 border-accent/30 bg-accent/5">
            <h2 className="font-semibold mb-1">Welcome to MsgNexus</h2>
            <p className="text-sm text-muted-foreground">
              Connect the apps you use below. Once connected, sync to pull messages into your unified inbox.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Integrations</h1>
            <p className="text-muted-foreground">Connect your messaging apps · {userEmail}</p>
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
          }} disabled={syncingAll} className="btn btn-primary text-sm disabled:opacity-70">
            {syncingAll ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync all</>}
          </button>
        </div>

        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
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
            status={gmail} connectHref="/api/auth/gmail" onSync={() => runSync('gmail', syncGmailAction)}
            syncing={syncing.gmail} onDisconnect={async () => { await disconnectGmailAction(); await reload(); toast.success('Disconnected'); }} />

          <OAuthCard icon={<Mail className="text-sky-500" size={20} />} title="Outlook" hint="MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET"
            status={outlook} connectHref="/api/auth/microsoft" onSync={() => runSync('outlook', syncOutlookAction)}
            syncing={syncing.outlook} onDisconnect={async () => { await disconnectOutlookAction(); await reload(); toast.success('Disconnected'); }} />

          <OAuthCard icon={<Hash className="text-purple-500" size={20} />} title="Slack" hint="SLACK_CLIENT_ID, SLACK_CLIENT_SECRET"
            status={slack} connectHref="/api/auth/slack" onSync={() => runSync('slack', syncSlackAction)}
            syncing={syncing.slack} onDisconnect={async () => { await disconnectSlackAction(); await reload(); toast.success('Disconnected'); }} />

          <OAuthCard icon={<MessageCircle className="text-indigo-500" size={20} />} title="Discord" hint="DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET"
            status={discord} connectHref="/api/auth/discord" onSync={() => runSync('discord', syncDiscordAction)}
            syncing={syncing.discord} onDisconnect={async () => { await disconnectDiscordAction(); await reload(); toast.success('Disconnected'); }} />

          <OAuthCard icon={<AtSign className="text-foreground" size={20} />} title="X / Twitter" hint="X_CLIENT_ID, X_CLIENT_SECRET"
            status={xPlatform} connectHref="/api/auth/x" onSync={() => runSync('x', syncXAction)}
            syncing={syncing.x} onDisconnect={async () => { await disconnectXAction(); await reload(); toast.success('Disconnected'); }} />

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                <Smartphone className="text-emerald-500" size={20} />
              </div>
              <div>
                <h2 className="font-semibold">SMS (Twilio)</h2>
                <p className="text-sm text-muted-foreground">Connect your Twilio number for inbound webhooks, sync, and send</p>
              </div>
            </div>
            {!twilio.configured && (
              <p className="text-sm text-amber-600">Server needs <code className="text-xs">TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER</code></p>
            )}
            {twilio.connected ? (
              <>
                <ConnectedActions identifier={twilio.identifier} lastSyncedAt={twilio.lastSyncedAt}
                  onSync={() => runSync('twilio', syncTwilioAction)} syncing={syncing.twilio}
                  onDisconnect={async () => { await disconnectTwilioAction(); await reload(); toast.success('Disconnected'); }} />
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground">Send a test SMS to your connected Twilio number</p>
                  <button
                    disabled={testSmsSending || !twilio.configured}
                    onClick={async () => {
                      const to = smsPhone || twilio.identifier;
                      if (!to) { toast.error('No phone number on file'); return; }
                      setTestSmsSending(true);
                      try {
                        const res = await fetch('/api/sms/send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            to,
                            message: 'Hello from MsgNexus! 📱',
                          }),
                        });
                        const text = await res.text();
                        const data = text ? JSON.parse(text) : {};
                        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                        toast.success('SMS sent!');
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
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Enter the same E.164 number as <code>TWILIO_PHONE_NUMBER</code> on the server.</p>
                <input type="tel" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="+15551234567"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" disabled={!twilio.configured} />
                <button
                  onClick={async () => {
                    const r = await connectTwilioAction(smsPhone);
                    if (r.error) toast.error(r.error);
                    else { toast.success('SMS connected'); await reload(); await runSync('twilio', syncTwilioAction); }
                  }}
                  disabled={!twilio.configured}
                  className="btn btn-primary text-sm disabled:opacity-50"
                >
                  Connect SMS (Twilio)
                </button>
              </div>
            )}
            {twilio.configured && (
              <p className="text-xs text-muted-foreground">Webhook: <code className="break-all">{webhookBase}/api/webhooks/twilio</code></p>
            )}
          </div>

          <PhoneCard icon={<Send className="text-green-600" size={20} />} title="WhatsApp" hint="WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID"
            status={whatsapp} phone={waPhone} setPhone={setWaPhone}
            onConnect={async () => {
              const r = await connectWhatsAppAction(waPhone);
              if (r.error) toast.error(r.error);
              else { toast.success('WhatsApp connected'); await reload(); await runSync('whatsapp', syncWhatsAppAction); }
            }}
            onSync={() => runSync('whatsapp', syncWhatsAppAction)} syncing={syncing.whatsapp}
            onDisconnect={async () => { await disconnectWhatsAppAction(); await reload(); toast.success('Disconnected'); }}
            webhookUrl={`${webhookBase}/api/webhooks/whatsapp`} />

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                <Send className="text-cyan-500" size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Telegram</h2>
                <p className="text-sm text-muted-foreground">Link via bot · TELEGRAM_BOT_TOKEN</p>
              </div>
            </div>
            {!telegram.configured && <p className="text-sm text-amber-600">Server needs TELEGRAM_BOT_TOKEN (+ TELEGRAM_BOT_USERNAME).</p>}
            {telegram.connected ? (
              <ConnectedActions identifier={telegram.identifier} lastSyncedAt={telegram.lastSyncedAt}
                onSync={() => runSync('telegram', syncTelegramAction)} syncing={syncing.telegram}
                onDisconnect={async () => { await disconnectTelegramAction(); await reload(); toast.success('Disconnected'); }} />
            ) : (
              <div className="space-y-3">
                <button disabled={!telegram.configured} onClick={async () => {
                  const r = await startTelegramLinkAction();
                  if (r.error) toast.error(r.error);
                  else if (r.linkCode) {
                    setTelegramCode(r.linkCode);
                    toast.success(`Send /link ${r.linkCode} to @${r.botUsername} on Telegram`);
                  }
                }} className="btn btn-primary text-sm disabled:opacity-50">Generate link code</button>
                {telegramCode && (
                  <p className="text-sm">Send to bot: <code className="bg-muted px-2 py-1 rounded">/link {telegramCode}</code></p>
                )}
              </div>
            )}
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

function OAuthCard({ icon, title, hint, status, connectHref, onSync, syncing, onDisconnect, callbackPath, oauthProviderLabel }: {
  icon: ReactNode; title: string; hint: string; status: Status;
  connectHref: string; onSync: () => void; syncing?: boolean; onDisconnect: () => void;
  callbackPath?: string; oauthProviderLabel?: string;
}) {
  const [callbackUrl, setCallbackUrl] = useState('');

  useEffect(() => {
    if (callbackPath && typeof window !== 'undefined') {
      setCallbackUrl(`${window.location.origin}${callbackPath}`);
    }
  }, [callbackPath]);

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">{icon}</div>
        <div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">OAuth connect + sync</p></div>
      </div>
      {!status.configured && <p className="text-sm text-amber-600">Server needs <code className="text-xs">{hint}</code></p>}
      {status.configured && callbackUrl && oauthProviderLabel && (
        <details className="text-xs text-muted-foreground rounded-xl border border-border p-3">
          <summary className="cursor-pointer font-medium text-foreground">Fix redirect_uri_mismatch</summary>
          <p className="mt-2">In {oauthProviderLabel} → Credentials → your OAuth client → <strong>Authorized redirect URIs</strong>, add exactly:</p>
          <code className="block break-all bg-muted p-2 rounded-lg mt-2 text-[11px]">{callbackUrl}</code>
        </details>
      )}
      {status.connected ? (
        <ConnectedActions identifier={status.identifier} lastSyncedAt={status.lastSyncedAt}
          onSync={onSync} syncing={syncing} onDisconnect={onDisconnect} />
      ) : (
        <a href={status.configured ? connectHref : '#'} className={`btn btn-primary text-sm inline-flex ${!status.configured ? 'opacity-50 pointer-events-none' : ''}`}>
          Connect {title}
        </a>
      )}
    </div>
  );
}

function PhoneCard({ icon, title, hint, status, phone, setPhone, onConnect, onSync, syncing, onDisconnect, webhookUrl }: {
  icon: ReactNode; title: string; hint: string; status: Status;
  phone: string; setPhone: (v: string) => void;
  onConnect: () => void; onSync: () => void; syncing?: boolean; onDisconnect: () => void; webhookUrl: string;
}) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">{icon}</div>
        <div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Phone + webhook</p></div>
      </div>
      {!status.configured && <p className="text-sm text-amber-600">Server needs <code className="text-xs">{hint}</code></p>}
      {status.connected ? (
        <ConnectedActions identifier={status.identifier} lastSyncedAt={status.lastSyncedAt}
          onSync={onSync} syncing={syncing} onDisconnect={onDisconnect} />
      ) : (
        <div className="space-y-3">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" disabled={!status.configured} />
          <button onClick={onConnect} disabled={!status.configured} className="btn btn-primary text-sm disabled:opacity-50">Connect {title}</button>
        </div>
      )}
      {status.configured && <p className="text-xs text-muted-foreground">Webhook: <code className="break-all">{webhookUrl}</code></p>}
    </div>
  );
}

function ConnectedActions({ identifier, lastSyncedAt, onSync, syncing, onDisconnect }: {
  identifier?: string; lastSyncedAt?: string; onSync: () => void; syncing?: boolean; onDisconnect: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Connected as <span className="font-medium">{identifier}</span>
        {lastSyncedAt && <span className="text-muted-foreground"> · Last sync {new Date(lastSyncedAt).toLocaleString()}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={onSync} disabled={syncing} className="btn btn-primary text-sm disabled:opacity-70">
          {syncing ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync now</>}
        </button>
        <button onClick={onDisconnect} className="btn btn-secondary text-sm"><Unplug size={16} /> Disconnect</button>
      </div>
    </div>
  );
}