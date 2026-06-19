'use client';

import { Users, MessageSquare, CreditCard, Plug, ScrollText, Key } from 'lucide-react';

type Stats = {
  users: { total: number; active: number; suspended: number; admins: number; signupsWeek: number };
  messages: { total: number; today: number; byPlatform: { platform: string; count: number }[] };
  subscriptions: { free: number; pro: number; enterprise: number };
  connections: { platform: string; count: number }[];
  auditEventsToday: number;
  activeApiKeys: number;
  recentAudit: { id: number; action: string; resource: string; actorEmail: string | null; createdAt: string }[];
};

export function AdminDashboardClient({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Total users', value: stats.users.total, sub: `${stats.users.signupsWeek} this week`, icon: Users, color: 'text-blue-500' },
    { label: 'Active users', value: stats.users.active, sub: `${stats.users.suspended} suspended`, icon: Users, color: 'text-emerald-500' },
    { label: 'Messages', value: stats.messages.total, sub: `${stats.messages.today} today`, icon: MessageSquare, color: 'text-violet-500' },
    { label: 'Pro subscribers', value: stats.subscriptions.pro, sub: `${stats.subscriptions.enterprise} enterprise`, icon: CreditCard, color: 'text-amber-500' },
    { label: 'Audit events today', value: stats.auditEventsToday, sub: 'Logged actions', icon: ScrollText, color: 'text-rose-500' },
    { label: 'Active API keys', value: stats.activeApiKeys, sub: 'Not revoked', icon: Key, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">MsgNexus system overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-semibold mt-1">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
              </div>
              <c.icon className={c.color} size={22} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Plug size={18} /> Connections by platform</h2>
          <div className="space-y-2">
            {stats.connections.map((c) => (
              <div key={c.platform} className="flex justify-between text-sm">
                <span>{c.platform}</span>
                <span className="font-medium">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4">Messages by platform</h2>
          <div className="space-y-2">
            {stats.messages.byPlatform.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet</p>
            ) : stats.messages.byPlatform.map((m) => (
              <div key={m.platform} className="flex justify-between text-sm">
                <span className="capitalize">{m.platform}</span>
                <span className="font-medium">{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><ScrollText size={18} /> Recent audit events</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Actor</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2">Resource</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAudit.map((a) => (
                  <tr key={a.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{a.actorEmail || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{a.action}</td>
                    <td className="py-2">{a.resource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}