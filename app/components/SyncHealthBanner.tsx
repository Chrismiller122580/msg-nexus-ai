'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getSyncHealthAction } from '@/app/actions/sync-health';
import { formatRelativeTime } from '@/lib/utils';

export function SyncHealthBanner() {
  const [state, setState] = useState<Awaited<ReturnType<typeof getSyncHealthAction>> | null>(null);

  useEffect(() => {
    getSyncHealthAction()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state) return null;

  if (state.reconnectNeeded) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="inline-flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <span>
            Reconnect {state.reconnectLabel || 'your mail'} — the token expired so background sync stopped.
          </span>
        </span>
        <Link href="/settings" className="btn btn-secondary text-xs shrink-0">
          Settings
        </Link>
      </div>
    );
  }

  if (state.lastErrors) {
    return (
      <div className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
        Last background sync had issues: {state.lastErrors}
      </div>
    );
  }

  if (!state.lastRunAt && !state.gmailLastSyncedAt) {
    return (
      <div className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
        Background sync runs hourly. Tap Sync in the header anytime.
      </div>
    );
  }

  const when = state.lastRunAt || state.gmailLastSyncedAt;
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground inline-flex items-center gap-2">
      <CheckCircle2 size={14} className="text-emerald-500" />
      Last sync {when ? formatRelativeTime(when) : 'just now'}
      {state.lastImported ? ` · ${state.lastImported} new` : ''}
      {state.lastSource ? ` · ${state.lastSource}` : ''}
    </div>
  );
}
