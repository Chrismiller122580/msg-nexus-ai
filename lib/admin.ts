import { getDb, users } from '@/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || 'demo@msgnexus.ai';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase().trim());
}

export async function ensureAdminRole(userId: number, email: string) {
  if (!isAdminEmail(email)) return;
  const db = getDb();
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, userId));
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  if (user.status === 'suspended') {
    throw new Error('Account suspended');
  }
  return user;
}

export function isAdminUser(user: { role?: string | null; status?: string | null } | null): boolean {
  return user?.role === 'admin' && user?.status !== 'suspended';
}