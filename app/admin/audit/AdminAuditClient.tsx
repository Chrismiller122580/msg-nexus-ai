'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { listAuditLogs } from '@/app/actions/admin/audit';

type AuditRow = Awaited<ReturnType<typeof listAuditLogs>>[number];

const ACTION_FILTERS = [
  'all',
  'user.update',
  'user.suspend',
  'subscription.update',
  'api_key.create',
  'api_key.revoke',
  'connection.sync',
];

export function AdminAuditClient({ initialLogs }: { initialLogs: AuditRow[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [loading, setLoading] = useState(false);

  async function refresh(q?: string, act?: string) {
    setLoading(true);
    try {
      const params: { search?: string; action?: string } = {};
      if (q) params.search = q;
      if (act && act !== 'all') params.action = act;
      setLogs(await listAuditLogs(params));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">Track admin actions and system events</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refresh(search, action)}
            placeholder="Search actor, action, resource..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); refresh(search, e.target.value); }}
            className="pl-10 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm appearance-none"
          >
            {ACTION_FILTERS.map((a) => (
              <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>
            ))}
          </select>
        </div>
        <button onClick={() => refresh(search, action)} disabled={loading} className="btn btn-secondary text-sm">
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Time</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Resource</th>
              <th className="p-3">Details</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">No audit events found</td>
              </tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="p-3">{log.actorEmail || '—'}</td>
                <td className="p-3 font-mono text-xs">{log.action}</td>
                <td className="p-3">
                  <span>{log.resource}</span>
                  {log.resourceId && <span className="text-muted-foreground text-xs ml-1">#{log.resourceId}</span>}
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                  {log.metadata ? JSON.stringify(log.metadata) : '—'}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{log.ipAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}