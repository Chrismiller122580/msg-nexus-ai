import { listAdminUsers } from '@/app/actions/admin/users';
import { AdminUsersClient } from './AdminUsersClient';

export default async function AdminUsersPage() {
  const users = await listAdminUsers();
  return <AdminUsersClient initialUsers={users} />;
}