'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { UserShell } from '@/app/components/UserShell';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';
import { getComposeOptions, sendMessageAction } from '@/app/actions/compose';
import type { PlatformId } from '@/lib/types';

type Options = Awaited<ReturnType<typeof getComposeOptions>>;

const PLATFORMS: Array<{ id: PlatformId; label: string; needsTo: boolean; hint: string }> = [
  { id: 'sms', label: 'SMS', needsTo: true, hint: 'Send via your Twilio number' },
  { id: 'whatsapp', label: 'WhatsApp', needsTo: true, hint: 'Cloud API text (recipient must opt in)' },
  { id: 'telegram', label: 'Telegram', needsTo: false, hint: 'Send to a linked Telegram chat' },
];

export function ComposeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [platform, setPlatform] = useState<PlatformId>('sms');
  const [connectionId, setConnectionId] = useState<number | undefined>();
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    getComposeOptions()
      .then((o) => {
        setOptions(o);
        const fromQuery = searchParams.get('platform') as PlatformId | null;
        const preferred = (fromQuery || o.defaultSendPlatform || 'sms') as PlatformId;
        const p =
          preferred === 'sms' || preferred === 'whatsapp' || preferred === 'telegram'
            ? preferred
            : 'sms';
        setPlatform(p);
        const preTo = searchParams.get('to');
        if (preTo) setTo(preTo);
        const def = o.sendDefaults || {};
        if (p === 'telegram') {
          setConnectionId(def.telegram ?? o.telegram[0]?.id);
        } else if (p === 'sms') {
          setConnectionId(def.sms ?? o.sms[0]?.id);
        } else if (p === 'whatsapp') {
          setConnectionId(def.whatsapp ?? o.whatsapp[0]?.id);
        }
        setLoading(false);
      })
      .catch(() => router.replace('/login?redirect=/compose'));
  }, [router, searchParams]);

  const available = useMemo(() => {
    if (!options) return [];
    return PLATFORMS.filter((p) => {
      if (p.id === 'sms') return options.sms.length > 0;
      if (p.id === 'whatsapp') return options.whatsapp.length > 0;
      if (p.id === 'telegram') return options.telegram.length > 0;
      return false;
    });
  }, [options]);

  const connections = useMemo(() => {
    if (!options) return [];
    if (platform === 'sms') return options.sms;
    if (platform === 'whatsapp') return options.whatsapp;
    if (platform === 'telegram') return options.telegram;
    return [];
  }, [options, platform]);

  const meta = PLATFORMS.find((p) => p.id === platform);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const toValue =
        platform === 'telegram'
          ? options?.telegram.find((t: { id: number; chatId: string }) => t.id === connectionId)
              ?.chatId || to
          : to;
      const r = await sendMessageAction({
        platform,
        to: toValue,
        body,
        connectionId,
      });
      if (r.error) {
        toast.error(r.error, { duration: 8000 });
        return;
      }
      toast.success('Message sent');
      setBody('');
      router.push('/inbox');
    } finally {
      setSending(false);
    }
  }

  if (loading || !options) {
    return (
      <UserShell>
        <LoadingSpinner message="Loading compose..." />
      </UserShell>
    );
  }

  return (
    <UserShell>
      <div className="max-w-xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compose</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send through a connected channel. Email and Slack remain read-only until send scopes are
            enabled.
          </p>
        </div>

        {available.length === 0 ? (
          <div className="card p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              No send-capable connections yet. Connect Twilio SMS, WhatsApp, or link Telegram in
              Settings.
            </p>
            <Link href="/settings" className="btn btn-primary text-sm inline-flex">
              Open Settings
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSend} className="card p-5 sm:p-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Channel
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {available.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPlatform(p.id);
                      const list =
                        p.id === 'sms'
                          ? options.sms
                          : p.id === 'whatsapp'
                            ? options.whatsapp
                            : options.telegram;
                      setConnectionId(list[0]?.id);
                    }}
                    className={`px-3 py-2 rounded-xl text-sm border min-h-[40px] ${
                      platform === p.id
                        ? 'border-indigo-500 bg-indigo-500/10 font-medium'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {meta && <p className="text-xs text-muted-foreground mt-2">{meta.hint}</p>}
            </div>

            {connections.length > 1 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  From connection
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                  value={connectionId ?? ''}
                  onChange={(e) => setConnectionId(Number(e.target.value) || undefined)}
                >
                  {connections.map((c: { id: number; identifier: string }) => (
                    <option key={c.id} value={c.id}>
                      {c.identifier}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {platform === 'telegram' && connections.length === 1 && (
              <p className="text-xs text-muted-foreground">
                Sending to <span className="font-medium text-foreground">{connections[0].identifier}</span>
              </p>
            )}

            {(platform === 'sms' || platform === 'whatsapp') && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  To (E.164)
                </label>
                <input
                  type="tel"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="+15551234567"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                  required
                />
              </div>
            )}

            {platform === 'telegram' && connections.length === 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Chat id
                </label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                  placeholder="Telegram chat id"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={4000}
                required
                placeholder="Write your message…"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-y min-h-[120px]"
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-right">{body.length}/4000</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" disabled={sending} className="btn btn-primary text-sm inline-flex gap-1.5 disabled:opacity-60">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send
              </button>
              <Link href="/dashboard" className="btn btn-secondary text-sm">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </UserShell>
  );
}
