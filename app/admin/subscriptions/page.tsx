import { listAdminSubscriptions } from '@/app/actions/admin/subscriptions';
import { AdminSubscriptionsClient } from './AdminSubscriptionsClient';

export default async function AdminSubscriptionsPage() {
  const subs = await listAdminSubscriptions();
  return <AdminSubscriptionsClient initialSubs={subs} />;
}