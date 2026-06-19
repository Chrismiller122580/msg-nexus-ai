'use client';

import { useState } from 'react';
import { Plus, Key, Copy, Ban, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  createApiKeyAdminAction,
  revokeApiKeyAdminAction,
  listAdminApiKeys,
} from '@/app/actions/admin/api-keys';

type KeyRow = Awaited<ReturnType<typeof listAdminApiKeys>>[number];
type UserOption = { id: number; email: string };

const SCOPES = ['messages:read', 'messages:write', 'connections:read', 'admin:read'];

export function AdminApiClient({
  initialKeys,
  users,
}: {
  initialKeys: KeyRow[];
  users: UserOption[];
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [scopes, setScopes] = useState<string[]>(['messages:read']);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setKeys(await listAdminApiKeys());
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const r = await createApiKeyAdminAction({
        name: name.trim(),
        userId: userId ? parseInt(userId, 10) : undefined,
        scopes,
        expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
      });
      if (r.error) { toast.error(r.error); return; }
      setNewKey(r.rawKey ?? null);
      toast.success('API key created');
      setShowCreate(false);
      setName('');
      setUserId('');
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    await revokeApiKeyAdminAction(id);
    toast.success('Key revoked');
    await refresh();
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard');
  }

  function toggleScope(scope: string) {
    setScopes((s) => s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">API keys</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage programmatic access to MsgNexus</p>
        </div>
        <button onClick={() => { setShowCreate(true); setNewKey(null); }} className="btn btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Create key
        </button>
      </div>

      {newKey && (
        <div className="card p-5 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Save this key — it won&apos;t be shown again</p>
              <code className="block mt-2 p-3 bg-muted rounded-lg text-xs font-mono break-all">{newKey}</code>
              <button onClick={() => copyKey(newKey)} className="btn btn-secondary text-xs mt-3 flex items-center gap-1.5">
                <Copy size={14} /> Copy key
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">New API key</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production integration"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">User (optional)</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
              >
                <option value="">System-wide (all users)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Expires in days (optional)</label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="Never"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-2">Scopes</label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScope(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    scopes.includes(s)
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating} className="btn btn-primary text-sm">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold mb-3 text-sm">API usage</h2>
        <pre className="text-xs bg-muted p-4 rounded-xl overflow-x-auto font-mono text-muted-foreground">
{`GET /api/v1/messages
Authorization: Bearer mnx_...

# Query params: limit (default 50), offset, platform`}
        </pre>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Name</th>
              <th className="p-3">Prefix</th>
              <th className="p-3">User</th>
              <th className="p-3">Scopes</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last used</th>
              <th className="p-3">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <Key className="mx-auto mb-2 opacity-40" size={24} />
                  No API keys yet
                </td>
              </tr>
            ) : keys.map((k) => (
              <tr key={k.id} className="border-t border-border">
                <td className="p-3 font-medium">{k.name}</td>
                <td className="p-3 font-mono text-xs">{k.keyPrefix}…</td>
                <td className="p-3 text-muted-foreground">{k.userEmail || '—'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map((s: string) => (
                      <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-muted">{s}</span>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    k.status === 'active' ? 'bg-emerald-500/15 text-emerald-600'
                    : k.status === 'revoked' ? 'bg-rose-500/15 text-rose-600'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {k.status}
                  </span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(k.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  {k.status === 'active' && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      title="Revoke"
                      className="p-1.5 rounded-lg hover:bg-muted text-rose-500"
                    >
                      <Ban size={14} />
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