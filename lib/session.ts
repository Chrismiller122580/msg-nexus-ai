import { cookies } from 'next/headers';
import { getDb, users, User } from '../db';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE = 'msgnexus-session';

export async function createSession(userId: number) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  if (!session) return null;

  const userId = parseInt(session, 10);
  if (isNaN(userId)) return null;

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
