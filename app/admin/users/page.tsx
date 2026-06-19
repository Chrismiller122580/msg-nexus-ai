import { listAdminUsers } from '@/app/actions/admin/users';
import { AdminUsersClient } from './AdminUsersClient';
import { getCurrentUser } from '@/lib/session';
import { getRolePermissions } from '@/lib/permissions';

export default async function AdminUsersPage() {
  const [users, actor] = await Promise.all([listAdminUsers(), getCurrentUser()]);
  const permissions = getRolePermissions(actor?.role);
  return <AdminUsersClient initialUsers={users} permissions={permissions} />;
}