import { getDb, users } from '@/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import {
  hasPermission,
  isStaffRole,
  type Permission,
  type Role,
} from '@/lib/permissions';

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (raw) {
    return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  if (process.env.NODE_ENV === 'development') {
    return ['demo@msgnexus.ai'];
  }
  return [];
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase().trim());
}

export async function ensureAdminRole(userId: number, email: string) {
  if (!isAdminEmail(email)) return;
  const db = getDb();
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, userId));
}

export function isAdminUser(user: { role?: string | null; status?: string | null } | null): boolean {
  return user?.role === 'admin' && user?.status !== 'suspended';
}

export function isStaffUser(user: { role?: string | null; status?: string | null } | null): boolean {
  return isStaffRole(user?.role) && user?.status !== 'suspended';
}

export function canAccessAdminPortal(user: { role?: string | null; status?: string | null } | null): boolean {
  return isStaffUser(user);
}

export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user || !isStaffUser(user)) {
    throw new Error('Staff access required');
  }
  return user;
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

export async function requirePermission(permission: Permission) {
  const user = await requireStaff();
  if (!hasPermission(user.role, permission)) {
    throw new Error(`Permission required: ${permission}`);
  }
  return user;
}

export function userHasPermission(user: { role?: string | null }, permission: Permission): boolean {
  return hasPermission(user.role, permission);
}

export type { Role, Permission };