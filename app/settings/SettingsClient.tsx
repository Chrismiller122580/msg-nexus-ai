'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mail, RefreshCw, Unplug, Loader2, MessageSquare, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { MsgNexusLogo } from '@/app/components/MsgNexusLogo';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';
import { getCurrentUserAction } from '@/app/actions/user';
import {
  disconnectGmailAction,
  getGmailStatus,
  syncGmailAction,
} from '@/app/actions/gmail';
import {
  disconnectOutlookAction,
  getOutlookStatus,
  syncOutlookAction,
} from '@/app/actions/outlook';
import {
  connectTwilioAction,
  disconnectTwilioAction,
  getTwilioStatus,
  syncTwilioAction,
} from '@/app/actions/twilio';
import { syncAllIntegrationsAction } from '@/app/actions/integrations';

type IntegrationStatus = {
  configured: boolean;
  connected: boolean;
  lastSyncedAt?: string;
};

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncingOutlook, setSyncingOutlook] = useState(false);
  const [syncingTwilio, setSyncingTwilio] = useState(false);
  const [connectingSms, setConnectingSms] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [gmail, setGmail] = useState<IntegrationStatus & { email?: string }>({ configured: false, connected: false });
  const [outlook, setOutlook] = useState<IntegrationStatus & { email?: string }>({ configured: false, connected: false });
  const [twilio, setTwilio] = useState<IntegrationStatus & { phoneNumber?: string }>({ configured: false, connected: false });

  async function reloadStatuses() {
    const [g, o, t] = await Promise.all([getGmailStatus(), getOutlookStatus(), getTwilioStatus()]);
    setGmail(g);
    setOutlook(o);
    setTwilio(t);
    if (t.phoneNumber) setSmsPhone(t.phoneNumber);
  }

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUserAction();
        if (!user) {
          router.replace('/login?redirect=/settings');
          return;
        }
        setUserEmail(user.email);
        await reloadStatuses();
      } catch {
        router.replace('/login?redirect=/settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  useEffect(() => {
    const gmailStatus = searchParams.get('gmail');
    const outlookStatus = searchParams.get('outlook');
    const error = searchParams.get('error');
    if (gmailStatus === 'connected') {
      toast.success('Gmail connected — syncing your inbox');
      reloadStatuses().then(() => syncGmailAction().then((r) => {
        if (r.imported != null) toast.success(`Imported ${r.imported} Gmail message${r.imported === 1 ? '' : 's'}`);
        reloadStatuses();
      }));
    }
    if (outlookStatus === 'connected') {
      toast.success('Outlook connected — syncing your inbox');
      reloadStatuses().then(() => syncOutlookAction().then((r) => {
        if (r.imported != null) toast.success(`Imported ${r.imported} Outlook message${r.imported === 1 ? '' : 's'}`);
        reloadStatuses();
      }));
    }
    if (error === 'outlook-not-configured') toast.error('Outlook OAuth is not configured on the server');
    if (error === 'outlook-auth-failed') toast.error('Outlook authorization failed');
  }, [searchParams]);

  async function handleSyncAll() {
    setSyncingAll(true);
    try {
      const result = await syncAllIntegrationsAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Synced all services — ${result.totalImported ?? 0} new messages`);
      await reloadStatuses();
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleGmailSync() {
    setSyncingGmail(true);
    try {
      const result = await syncGmailAction();
      if (result.error) toast.error(result.error);
      else toast.success(`Imported ${result.imported ?? 0} Gmail messages`);
      await reloadStatuses();
    } finally {
      setSyncingGmail(false);
    }
  }

  async function handleOutlookSync() {
    setSyncingOutlook(true);
    try {
      const result = await syncOutlookAction();
      if (result.error) toast.error(result.error);
      else toast.success(`Imported ${result.imported ?? 0} Outlook messages`);
      await reloadStatuses();
    } finally {
      setSyncingOutlook(false);
    }
  }

  async function handleTwilioSync() {
    setSyncingTwilio(true);
    try {
      const result = await syncTwilioAction();
      if (result.error) toast.error(result.error);
      else toast.success(`Imported ${result.imported ?? 0} SMS messages`);
      await reloadStatuses();
    } finally {
      setSyncingTwilio(false);
    }
  }

  async function handleConnectSms() {
    if (!smsPhone.trim()) {
      toast.error('Enter your phone number');
      return;
    }
    setConnectingSms(true);
    try {
      const result = await connectTwilioAction(smsPhone);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('SMS connected');
      await reloadStatuses();
      await handleTwilioSync();
    } finally {
      setConnectingSms(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading settings..." />;
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/twilio`
    : '/api/webhooks/twilio';

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
            <p className="text-muted-foreground">Signed in as {userEmail}</p>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="btn btn-primary text-sm disabled:opacity-70"
          >
            {syncingAll ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync all</>}
          </button>
        </div>

        <div className="space-y-4">
          <IntegrationCard
            icon={<Mail className="text-blue-500" size={20} />}
            title="Gmail"
            description="Import real emails via Google OAuth"
            configured={gmail.configured}
            configuredHint="GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
            connected={gmail.connected}
            identifier={gmail.email}
            lastSyncedAt={gmail.lastSyncedAt}
            onSync={handleGmailSync}
            syncing={syncingGmail}
            onDisconnect={async () => { await disconnectGmailAction(); await reloadStatuses(); toast.success('Gmail disconnected'); }}
            connectHref={gmail.configured ? '/api/auth/gmail' : undefined}
          />

          <IntegrationCard
            icon={<Mail className="text-sky-500" size={20} />}
            title="Outlook"
            description="Import Microsoft 365 / Outlook email"
            configured={outlook.configured}
            configuredHint="MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET"
            connected={outlook.connected}
            identifier={outlook.email}
            lastSyncedAt={outlook.lastSyncedAt}
            onSync={handleOutlookSync}
            syncing={syncingOutlook}
            onDisconnect={async () => { await disconnectOutlookAction(); await reloadStatuses(); toast.success('Outlook disconnected'); }}
            connectHref={outlook.configured ? '/api/auth/microsoft' : undefined}
          />

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Smartphone className="text-emerald-500" size={20} />
              </div>
              <div>
                <h2 className="font-semibold">SMS (Twilio)</h2>
                <p className="text-sm text-muted-foreground">Sync SMS via Twilio API + webhooks</p>
              </div>
            </div>

            {!twilio.configured && (
              <p className="text-sm text-amber-600">
                Server needs <code className="text-xs">TWILIO_ACCOUNT_SID</code> and{' '}
                <code className="text-xs">TWILIO_AUTH_TOKEN</code>.
              </p>
            )}

            {twilio.connected ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Connected: <span className="font-medium">{twilio.phoneNumber}</span>
                  {twilio.lastSyncedAt && (
                    <span className="text-muted-foreground"> · Last sync {new Date(twilio.lastSyncedAt).toLocaleString()}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleTwilioSync} disabled={syncingTwilio} className="btn btn-primary text-sm disabled:opacity-70">
                    {syncingTwilio ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync now</>}
                  </button>
                  <button onClick={async () => { await disconnectTwilioAction(); await reloadStatuses(); toast.success('SMS disconnected'); }} className="btn btn-secondary text-sm">
                    <Unplug size={16} /> Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                  disabled={!twilio.configured}
                />
                <button
                  onClick={handleConnectSms}
                  disabled={!twilio.configured || connectingSms}
                  className="btn btn-primary text-sm disabled:opacity-50"
                >
                  {connectingSms ? <><Loader2 className="animate-spin" size={16} /> Connecting...</> : 'Connect SMS'}
                </button>
              </div>
            )}

            {twilio.configured && (
              <p className="text-xs text-muted-foreground">
                Twilio webhook URL: <code className="break-all">{webhookUrl}</code>
              </p>
            )}
          </div>

          <div className="card p-6 border-dashed">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="text-muted-foreground" size={20} />
              <h2 className="font-semibold text-muted-foreground">Coming soon</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Slack, Discord, Telegram, WhatsApp Business — same connector pattern as above.
            </p>
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

function IntegrationCard({
  icon,
  title,
  description,
  configured,
  configuredHint,
  connected,
  identifier,
  lastSyncedAt,
  onSync,
  syncing,
  onDisconnect,
  connectHref,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  configured: boolean;
  configuredHint: string;
  connected: boolean;
  identifier?: string;
  lastSyncedAt?: string;
  onSync: () => void;
  syncing: boolean;
  onDisconnect: () => void;
  connectHref?: string;
}) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {!configured && (
        <p className="text-sm text-amber-600">
          Server needs <code className="text-xs">{configuredHint}</code> in environment variables.
        </p>
      )}

      {connected ? (
        <div className="space-y-3">
          <p className="text-sm">
            Connected as <span className="font-medium">{identifier}</span>
            {lastSyncedAt && (
              <span className="text-muted-foreground"> · Last sync {new Date(lastSyncedAt).toLocaleString()}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={onSync} disabled={syncing} className="btn btn-primary text-sm disabled:opacity-70">
              {syncing ? <><Loader2 className="animate-spin" size={16} /> Syncing...</> : <><RefreshCw size={16} /> Sync now</>}
            </button>
            <button onClick={onDisconnect} className="btn btn-secondary text-sm">
              <Unplug size={16} /> Disconnect
            </button>
          </div>
        </div>
      ) : (
        <a
          href={connectHref || '#'}
          className={`btn btn-primary text-sm inline-flex ${!connectHref ? 'opacity-50 pointer-events-none' : ''}`}
        >
          Connect {title}
        </a>
      )}
    </div>
  );
}