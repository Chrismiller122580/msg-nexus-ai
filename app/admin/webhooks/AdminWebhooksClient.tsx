'use client';

import { useState } from 'react';
import { Plus, Webhook, Trash2, Play, Power } from 'lucide-react';
import { toast } from 'sonner';
import {
  createWebhookAdminAction,
  deleteWebhookAdminAction,
  listAdminWebhooks,
  listWebhookDeliveries,
  testWebhookAdminAction,
  toggleWebhookAdminAction,
} from '@/app/actions/admin/webhooks';
import { WEBHOOK_EVENTS } from '@/lib/webhook-events';

type HookRow = Awaited<ReturnType<typeof listAdminWebhooks>>[number];
type DeliveryRow = Awaited<ReturnType<typeof listWebhookDeliveries>>[number];

export function AdminWebhooksClient({
  initialWebhooks,
  initialDeliveries,
}: {
  initialWebhooks: HookRow[];
  initialDeliveries: DeliveryRow[];
}) {
  const [hooks, setHooks] = useState(initialWebhooks);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENTS]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function refresh() {
    const [h, d] = await Promise.all([listAdminWebhooks(), listWebhookDeliveries()]);
    setHooks(h);
    setDeliveries(d);
  }

  async function handleCreate() {
    const r = await createWebhookAdminAction({ name, url, events });
    if (r.error) { toast.error(r.error); return; }
    setNewSecret(r.secret ?? null);
    toast.success('Webhook created');
    setShowCreate(false);
    setName('');
    setUrl('');
    await refresh();
  }

  function toggleEvent(ev: string) {
    setEvents((e) => e.includes(ev) ? e.filter((x) => x !== ev) : [...e, ev]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">Outbound event notifications to your endpoints</p>
        </div>
        <button onClick={() => { setShowCreate(true); setNewSecret(null); }} className="btn btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Add webhook
        </button>
      </div>

      {newSecret && (
        <div className="card p-5 border-amber-500/30 bg-amber-500/5">
          <p className="font-medium text-sm mb-2">Signing secret — save it now</p>
          <code className="block p-3 bg-muted rounded-lg text-xs font-mono break-all">{newSecret}</code>
          <p className="text-xs text-muted-foreground mt-2">Verify with HMAC-SHA256 via the <code>X-MsgNexus-Signature</code> header</p>
        </div>
      )}

      {showCreate && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">New webhook</h2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/msgnexus" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />
          <div className="flex flex-wrap gap-2">
            {WEBHOOK_EVENTS.map((ev) => (
              <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                className={`text-xs px-3 py-1.5 rounded-full border ${events.includes(ev) ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'}`}>
                {ev}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn btn-primary text-sm">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="p-3">Name</th>
              <th className="p-3">URL</th>
              <th className="p-3">Events</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last fired</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {hooks.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground"><Webhook className="mx-auto mb-2 opacity-40" size={24} />No webhooks configured</td></tr>
            ) : hooks.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="p-3 font-medium">{h.name}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{h.url}</td>
                <td className="p-3 text-xs">{h.events.join(', ')}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${h.enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted'}`}>
                    {h.enabled ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{h.lastTriggeredAt ? new Date(h.lastTriggeredAt).toLocaleString() : '—'}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button title="Test" onClick={async () => { await testWebhookAdminAction(h.id); toast.success('Test sent'); await refresh(); }} className="p-1.5 rounded-lg hover:bg-muted"><Play size={14} /></button>
                    <button title={h.enabled ? 'Disable' : 'Enable'} onClick={async () => { await toggleWebhookAdminAction(h.id, !h.enabled); await refresh(); }} className="p-1.5 rounded-lg hover:bg-muted"><Power size={14} /></button>
                    <button title="Delete" onClick={async () => { await deleteWebhookAdminAction(h.id); toast.success('Deleted'); await refresh(); }} className="p-1.5 rounded-lg hover:bg-muted text-rose-500"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-4">Recent deliveries</h2>
        <div className="space-y-2">
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries yet</p>
          ) : deliveries.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
              <span className="font-mono text-xs">{d.event}</span>
              <span className={`text-xs ${d.status === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>{d.status} {d.responseCode ? `(${d.responseCode})` : ''}</span>
              <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}