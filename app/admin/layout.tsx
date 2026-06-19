import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { isAdminUser } from '@/lib/admin';
import { AdminShell } from './components/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    redirect('/login?redirect=/admin');
  }

  return <AdminShell adminEmail={user.email}>{children}</AdminShell>;
}