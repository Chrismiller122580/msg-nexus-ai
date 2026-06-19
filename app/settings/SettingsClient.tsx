'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Mail, RefreshCw, Unplug, Loader2, Smartphone,
  Hash, MessageCircle, Send, AtSign,
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
  const [smsPhone, setSmsPhone] = useState('');
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
    setTwilio(t);
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
  }, [searchParams]);

  async function runSync(key: string, fn: () => Promise<{ error?: string; imported?: number }>) {
    setSyncing((s) => ({ ...s, [key]: true }));
    try {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else toast.success(`Imported ${r.imported ?? 0} messages`);
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
        <ThemeToggle />
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/inbox" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={16} /> Back to inbox
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Integrations</h1>
            <p className="text-muted-foreground">Connect all 8 platforms · {userEmail}</p>
          </div>
          <button onClick={async () => {
            setSyncingAll(true);
            try {
              const r = await syncAllIntegrationsAction();
              if (r.error) toast.error(r.error);
              else toast.success(`Synced all — ${r.totalImported ?? 0} new messages`);
              await reload();
            } finally { setSyncingAll(false); }
          }} disabled={syncingAll} className="btn btn-primary text-sm disabled:opacity-70">
            {syncingAll ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync all</>}
          </button>
        </div>

        <div className="space-y-4">
          <OAuthCard icon={<Mail className="text-blue-500" size={20} />} title="Gmail" hint="GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
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

          <PhoneCard icon={<Smartphone className="text-emerald-500" size={20} />} title="SMS (Twilio)" hint="TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN"
            status={twilio} phone={smsPhone} setPhone={setSmsPhone}
            onConnect={async () => {
              const r = await connectTwilioAction(smsPhone);
              if (r.error) toast.error(r.error);
              else { toast.success('SMS connected'); await reload(); await runSync('twilio', syncTwilioAction); }
            }}
            onSync={() => runSync('twilio', syncTwilioAction)} syncing={syncing.twilio}
            onDisconnect={async () => { await disconnectTwilioAction(); await reload(); toast.success('Disconnected'); }}
            webhookUrl={`${webhookBase}/api/webhooks/twilio`} />

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
            <p className="text-sm text-muted-foreground">No public API. Requires a Mac relay (BlueBubbles / AirMessage). Use simulated messages in onboarding for now.</p>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground underline">
            Manage simulated platform connections
          </Link>
        </div>
      </div>
    </div>
  );
}

function OAuthCard({ icon, title, hint, status, connectHref, onSync, syncing, onDisconnect }: {
  icon: ReactNode; title: string; hint: string; status: Status;
  connectHref: string; onSync: () => void; syncing?: boolean; onDisconnect: () => void;
}) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">{icon}</div>
        <div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">OAuth connect + sync</p></div>
      </div>
      {!status.configured && <p className="text-sm text-amber-600">Server needs <code className="text-xs">{hint}</code></p>}
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