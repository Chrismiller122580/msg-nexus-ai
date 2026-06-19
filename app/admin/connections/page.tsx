import { listAdminConnections } from '@/app/actions/admin/connections';
import { AdminConnectionsClient } from './AdminConnectionsClient';

export default async function AdminConnectionsPage() {
  const connections = await listAdminConnections();
  return <AdminConnectionsClient initialConnections={connections} />;
}