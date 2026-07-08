import { getDb, users, subscriptions } from '@/db';
import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/session';
import { ensureAdminRole } from '@/lib/admin';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import { sendWelcomeEmail } from '@/lib/resend';

export async function findOrCreateUser(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDb();

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
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

  const [existingSub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);

  if (!existingSub) {
    await db.insert(subscriptions).values({
      userId: user.id,
      plan: 'free',
      status: 'active',
    });
  }

  await ensureAdminRole(user.id, user.email);

  const [refreshed] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const finalUser = refreshed ?? user;

  if (isNewUser) {
    void dispatchWebhookEvent('user.created', {
      userId: finalUser.id,
      email: finalUser.email,
      name: finalUser.name,
    });
    void sendWelcomeEmail({
      email: finalUser.email,
      name: finalUser.name,
    });
  }

  return finalUser;
}

export async function loginUser(email: string) {
  const user = await findOrCreateUser(email);
  await createSession(user.id);

  return {
    user: { email: user.email, name: user.name || undefined },
    onboarded: true,
  };
}
