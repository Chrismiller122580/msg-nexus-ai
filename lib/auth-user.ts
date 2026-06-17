import { getDb, users, connectedAccounts, gmailConnections } from '@/db';
import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/session';

export async function findOrCreateUser(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDb();

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user) {
    const name = normalizedEmail.split('@')[0];
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: name.charAt(0).toUpperCase() + name.slice(1),
      })
      .returning();
    user = newUser;
  }

  return user;
}

export async function loginUser(email: string) {
  const user = await findOrCreateUser(email);
  await createSession(user.id);

  const db = getDb();
  const [connected] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, user.id))
    .limit(1);

  const [gmail] = await db
    .select({ id: gmailConnections.id })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, user.id))
    .limit(1);

  return {
    user: { email: user.email, name: user.name || undefined },
    onboarded: Boolean(connected || gmail),
  };
}
