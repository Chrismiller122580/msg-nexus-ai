import { listAdminWebhooks, listWebhookDeliveries } from '@/app/actions/admin/webhooks';
import { AdminWebhooksClient } from './AdminWebhooksClient';

export default async function AdminWebhooksPage() {
  const [hooks, deliveries] = await Promise.all([listAdminWebhooks(), listWebhookDeliveries()]);
  return <AdminWebhooksClient initialWebhooks={hooks} initialDeliveries={deliveries} />;
}