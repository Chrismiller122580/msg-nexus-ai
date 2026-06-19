'use client';

import { BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react';

type Analytics = {
  signupsByDay: { day: string; count: number }[];
  messagesByDay: { day: string; count: number }[];
  insightsByCategory: { category: string; count: number }[];
  topAuditActions: { action: string; count: number }[];
  avgMessagesPerUser: number;
};

function BarChart({ data, labelKey, valueKey, color }: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  color: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="space-y-2">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for this period</p>
      ) : data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        const label = String(d[labelKey]);
        const shortLabel = label.length > 10 ? label.slice(5) : label;
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="w-16 text-xs text-muted-foreground shrink-0">{shortLabel}</span>
            <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
              <div className={`h-full ${color} rounded-lg transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 text-right font-medium text-xs">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminAnalyticsClient({ analytics }: { analytics: Analytics }) {
  const totalSignups = analytics.signupsByDay.reduce((s, d) => s + d.count, 0);
  const totalMessages = analytics.messagesByDay.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">14-day trends and category breakdown</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Signups (14d)</p>
              <p className="text-3xl font-semibold mt-1">{totalSignups}</p>
            </div>
            <Users className="text-blue-500" size={22} />
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Messages (14d)</p>
              <p className="text-3xl font-semibold mt-1">{totalMessages}</p>
            </div>
            <MessageSquare className="text-violet-500" size={22} />
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg msgs / user</p>
              <p className="text-3xl font-semibold mt-1">{analytics.avgMessagesPerUser}</p>
            </div>
            <TrendingUp className="text-emerald-500" size={22} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={18} /> Signups by day
          </h2>
          <BarChart data={analytics.signupsByDay} labelKey="day" valueKey="count" color="bg-blue-500" />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={18} /> Messages by day
          </h2>
          <BarChart data={analytics.messagesByDay} labelKey="day" valueKey="count" color="bg-violet-500" />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4">Insights by category</h2>
          <div className="space-y-2">
            {analytics.insightsByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No insights yet</p>
            ) : analytics.insightsByCategory.map((c) => (
              <div key={c.category} className="flex justify-between text-sm">
                <span className="capitalize">{c.category}</span>
                <span className="font-medium">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4">Top audit actions (14d)</h2>
          <div className="space-y-2">
            {analytics.topAuditActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events yet</p>
            ) : analytics.topAuditActions.map((a) => (
              <div key={a.action} className="flex justify-between text-sm">
                <span className="font-mono text-xs">{a.action}</span>
                <span className="font-medium">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}