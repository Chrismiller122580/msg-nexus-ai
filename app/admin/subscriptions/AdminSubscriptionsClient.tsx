'use client';

import { toast } from 'sonner';
import { updateSubscriptionAdminAction } from '@/app/actions/admin/subscriptions';

type SubRow = Awaited<ReturnType<typeof import('@/app/actions/admin/subscriptions').listAdminSubscriptions>>[number];

export function AdminSubscriptionsClient({ initialSubs }: { initialSubs: SubRow[] }) {
  async function update(userId: number, updates: Parameters<typeof updateSubscriptionAdminAction>[1]) {
    await updateSubscriptionAdminAction(userId, updates);
    toast.success('Subscription updated');
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Plans and billing status (Stripe-ready fields)</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">User</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Period end</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialSubs.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{s.email}</div>
                  <div className="text-xs text-muted-foreground">{s.name}</div>
                </td>
                <td className="p-3">
                  <select
                    value={s.plan}
                    onChange={(e) => update(s.userId, { plan: e.target.value as 'free' | 'pro' | 'enterprise' })}
                    className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={s.status}
                    onChange={(e) => update(s.userId, { status: e.target.value as 'active' | 'trialing' | 'cancelled' | 'past_due' })}
                    className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                  >
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past due</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}
                </td>
                <td className="p-3">
                  {s.status !== 'cancelled' && (
                    <button
                      onClick={() => update(s.userId, { status: 'cancelled', cancelAtPeriodEnd: true })}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Cancel
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