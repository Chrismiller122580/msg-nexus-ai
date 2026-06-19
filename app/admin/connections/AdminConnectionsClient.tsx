'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { triggerUserSyncAdminAction } from '@/app/actions/admin/connections';

type ConnRow = Awaited<ReturnType<typeof import('@/app/actions/admin/connections').listAdminConnections>>[number];

export function AdminConnectionsClient({ initialConnections }: { initialConnections: ConnRow[] }) {
  const [syncing, setSyncing] = useState<number | null>(null);

  async function syncUser(userId: number) {
    setSyncing(userId);
    try {
      const r = await triggerUserSyncAdminAction(userId);
      toast.success(`Synced ${r.totalImported} messages for user ${userId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(null);
    }
  }

  const uniqueUsers = [...new Set(initialConnections.map((c) => c.userId))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Connections</h1>
        <p className="text-sm text-muted-foreground mt-1">{initialConnections.length} platform connections across {uniqueUsers.length} users</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">User</th>
              <th className="p-3">Platform</th>
              <th className="p-3">Identifier</th>
              <th className="p-3">Connected</th>
              <th className="p-3">Last sync</th>
              <th className="p-3">Sync</th>
            </tr>
          </thead>
          <tbody>
            {initialConnections.map((c, i) => (
              <tr key={`${c.userId}-${c.platform}-${i}`} className="border-t border-border">
                <td className="p-3 font-medium">{c.email}</td>
                <td className="p-3">{c.platform}</td>
                <td className="p-3 text-muted-foreground">{c.identifier}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(c.connectedAt).toLocaleString()}</td>
                <td className="p-3 text-xs text-muted-foreground">{c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : '—'}</td>
                <td className="p-3">
                  {!c.platform.startsWith('Simulated') && (
                    <button
                      onClick={() => syncUser(c.userId)}
                      disabled={syncing === c.userId}
                      className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={syncing === c.userId ? 'animate-spin' : ''} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}