'use server';

import { getCurrentUser } from '@/lib/session';
import { isStaffUser } from '@/lib/admin';

export async function getCurrentUserAction(): Promise<{
  email: string;
  name?: string;
  role: string;
  isStaff: boolean;
  isAdmin: boolean;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return {
    email: user.email,
    name: user.name || undefined,
    role: user.role,
    isStaff: isStaffUser(user),
    isAdmin: user.role === 'admin',
  };
}