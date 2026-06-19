import { listAdminApiKeys, listUsersForApiKeySelect } from '@/app/actions/admin/api-keys';
import { AdminApiClient } from './AdminApiClient';

export default async function AdminApiPage() {
  const [keys, users] = await Promise.all([listAdminApiKeys(), listUsersForApiKeySelect()]);
  return <AdminApiClient initialKeys={keys} users={users} />;
}