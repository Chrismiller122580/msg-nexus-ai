'use server';

import { getCurrentUser } from '@/lib/session';

export async function getCurrentUserAction(): Promise<{ email: string; name?: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { email: user.email, name: user.name || undefined };
}