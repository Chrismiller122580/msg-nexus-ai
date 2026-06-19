import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { canAccessAdminPortal } from '@/lib/admin';
import { getRolePermissions } from '@/lib/permissions';
import { AdminShell } from './components/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdminPortal(user)) {
    redirect('/login?redirect=/admin');
  }

  return (
    <AdminShell adminEmail={user.email} role={user.role} permissions={getRolePermissions(user.role)}>
      {children}
    </AdminShell>
  );
}