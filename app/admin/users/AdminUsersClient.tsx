'use client';

import { useState } from 'react';
import { Search, Ban, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { listAdminUsers, updateUserAdminAction } from '@/app/actions/admin/users';
import { updateSubscriptionAdminAction } from '@/app/actions/admin/subscriptions';
import type { Permission } from '@/lib/permissions';

type UserRow = Awaited<ReturnType<typeof listAdminUsers>>[number];

const ROLES = ['user', 'support', 'billing', 'admin'] as const;

export function AdminUsersClient({
  initialUsers,
  permissions,
}: {
  initialUsers: UserRow[];
  permissions: Permission[];
}) {
  const canWrite = permissions.includes('users.write');
  const canEditRoles = permissions.includes('users.roles');
  const canEditPlans = permissions.includes('subscriptions.write');
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh(q?: string) {
    setLoading(true);
    try {
      setUsers(await listAdminUsers(q));
    } finally {
      setLoading(false);
    }
  }

  async function update(userId: number, updates: Parameters<typeof updateUserAdminAction>[1]) {
    const r = await updateUserAdminAction(userId, updates);
    if (r.error) toast.error(r.error);
    else { toast.success('User updated'); await refresh(search || undefined); }
  }

  async function changePlan(userId: number, plan: 'free' | 'pro' | 'enterprise') {
    await updateSubscriptionAdminAction(userId, { plan });
    toast.success(`Plan → ${plan}`);
    await refresh(search || undefined);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage accounts, roles, and status</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refresh(search)}
            placeholder="Search email or name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm"
          />
        </div>
        <button onClick={() => refresh(search || undefined)} disabled={loading} className="btn btn-secondary text-sm">
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">User</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Msgs</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.name || '—'}</div>
                </td>
                <td className="p-3">
                  {canEditPlans ? (
                    <select
                      value={u.plan}
                      onChange={(e) => changePlan(u.id, e.target.value as 'free' | 'pro' | 'enterprise')}
                      className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  ) : (
                    <span className="text-xs">{u.plan}</span>
                  )}
                </td>
                <td className="p-3">
                  {canEditRoles ? (
                    <select
                      value={u.role}
                      onChange={(e) => update(u.id, { role: e.target.value as typeof ROLES[number] })}
                      className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-muted'}`}>
                      {u.role}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="p-3">{u.messageCount}</td>
                <td className="p-3 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="p-3">
                  {canWrite && (
                    <div className="flex gap-1">
                      {u.status === 'active' ? (
                        <button title="Suspend" onClick={() => update(u.id, { status: 'suspended' })} className="p-1.5 rounded-lg hover:bg-muted text-rose-500">
                          <Ban size={14} />
                        </button>
                      ) : (
                        <button title="Activate" onClick={() => update(u.id, { status: 'active' })} className="p-1.5 rounded-lg hover:bg-muted text-emerald-500">
                          <CheckCircle size={14} />
                        </button>
                      )}
                    </div>
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