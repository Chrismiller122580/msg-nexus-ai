import { listAuditLogs } from '@/app/actions/admin/audit';
import { AdminAuditClient } from './AdminAuditClient';

export default async function AdminAuditPage() {
  const logs = await listAuditLogs();
  return <AdminAuditClient initialLogs={logs} />;
}