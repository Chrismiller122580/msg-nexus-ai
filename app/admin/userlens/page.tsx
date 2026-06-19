import { getUserlensStatus, listUserlensRuns } from '@/app/actions/admin/userlens';
import { AdminUserlensClient } from './AdminUserlensClient';
import { getCurrentUser } from '@/lib/session';
import { getRolePermissions } from '@/lib/permissions';

export default async function AdminUserlensPage() {
  const [status, runs, actor] = await Promise.all([
    getUserlensStatus(),
    listUserlensRuns(),
    getCurrentUser(),
  ]);
  const permissions = getRolePermissions(actor?.role);

  return (
    <AdminUserlensClient
      status={status}
      initialRuns={runs}
      canRun={permissions.includes('userlens.write')}
    />
  );
}