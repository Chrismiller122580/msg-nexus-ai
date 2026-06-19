'use server';

import { getCurrentUser } from '@/lib/session';
import { isAdminUser } from '@/lib/admin';

export async function getCurrentUserAction(): Promise<{ email: string; name?: string; isAdmin: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { email: user.email, name: user.name || undefined, isAdmin: isAdminUser(user) };
}