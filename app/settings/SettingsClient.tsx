'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mail, RefreshCw, Unplug, Loader2 } from 'lucide-react';
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

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [gmail, setGmail] = useState<{
    configured: boolean;
    connected: boolean;
    email?: string;
    lastSyncedAt?: string;
  }>({ configured: false, connected: false });

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUserAction();
        if (!user) {
          router.replace('/login?redirect=/settings');
          return;
        }
        setUserEmail(user.email);
        setGmail(await getGmailStatus());
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
    const error = searchParams.get('error');
    if (gmailStatus === 'connected') {
      toast.success('Gmail connected — syncing your inbox');
      getGmailStatus().then(setGmail);
      syncGmailAction().then((result) => {
        if (result.error) toast.error(result.error);
        else if (result.imported != null) {
          toast.success(`Imported ${result.imported} email${result.imported === 1 ? '' : 's'} from Gmail`);
        }
        getGmailStatus().then(setGmail);
      });
    }
    if (error === 'gmail-not-configured') {
      toast.error('Gmail OAuth is not configured on the server');
    }
    if (error === 'gmail-auth-failed') {
      toast.error('Gmail authorization failed');
    }
  }, [searchParams]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncGmailAction();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Imported ${result.imported ?? 0} new messages from Gmail`);
        setGmail(await getGmailStatus());
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    await disconnectGmailAction();
    setGmail(await getGmailStatus());
    toast.success('Gmail disconnected');
  }

  if (loading) {
    return <LoadingSpinner message="Loading settings..." />;
  }

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

        <h1 className="text-3xl font-semibold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">Signed in as {userEmail}</p>

        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Mail className="text-blue-500" size={20} />
            </div>
            <div>
              <h2 className="font-semibold">Gmail</h2>
              <p className="text-sm text-muted-foreground">Import real emails into your MsgNexus inbox</p>
            </div>
          </div>

          {!gmail.configured && (
            <p className="text-sm text-amber-600">
              Server needs <code className="text-xs">GOOGLE_CLIENT_ID</code> and{' '}
              <code className="text-xs">GOOGLE_CLIENT_SECRET</code> in environment variables.
            </p>
          )}

          {gmail.connected ? (
            <div className="space-y-3">
              <p className="text-sm">
                Connected as <span className="font-medium">{gmail.email}</span>
                {gmail.lastSyncedAt && (
                  <span className="text-muted-foreground">
                    {' '}· Last sync {new Date(gmail.lastSyncedAt).toLocaleString()}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn btn-primary text-sm disabled:opacity-70"
                >
                  {syncing ? (
                    <><Loader2 className="animate-spin" size={16} /> Syncing...</>
                  ) : (
                    <><RefreshCw size={16} /> Sync now</>
                  )}
                </button>
                <button onClick={handleDisconnect} className="btn btn-secondary text-sm">
                  <Unplug size={16} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <a
              href={gmail.configured ? '/api/auth/gmail' : '#'}
              className={`btn btn-primary text-sm inline-flex ${!gmail.configured ? 'opacity-50 pointer-events-none' : ''}`}
            >
              Connect Gmail
            </a>
          )}
        </div>

        <div className="mt-6">
          <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground underline">
            Manage platform connections
          </Link>
        </div>
      </div>
    </div>
  );
}