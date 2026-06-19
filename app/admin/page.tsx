import { getAdminDashboardStats } from '@/app/actions/admin/dashboard';
import { AdminDashboardClient } from './AdminDashboardClient';

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();
  return <AdminDashboardClient stats={stats} />;
}