'use server';

import { getDb, apiKeys, users } from '@/db';
import { requireAdmin } from '@/lib/admin';
import { generateApiKey } from '@/lib/api-keys';
import { logAudit } from '@/lib/audit';
import { eq, desc, isNull, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function listAdminApiKeys() {
  await requireAdmin();
  const db = getDb();

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      userId: apiKeys.userId,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
      userEmail: users.email,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .orderBy(desc(apiKeys.createdAt))
    .limit(100);

  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.keyPrefix,
    scopes: Array.isArray(r.scopes) ? r.scopes : [],
    userId: r.userId,
    userEmail: r.userEmail,
    lastUsedAt: r.lastUsedAt?.toISOString(),
    expiresAt: r.expiresAt?.toISOString(),
    revokedAt: r.revokedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
    status: r.revokedAt ? 'revoked' : r.expiresAt && new Date(r.expiresAt) < new Date() ? 'expired' : 'active',
  }));
}

export async function createApiKeyAdminAction(params: {
  name: string;
  userId?: number;
  scopes?: string[];
  expiresInDays?: number;
}): Promise<{ success?: boolean; error?: string; rawKey?: string; prefix?: string }> {
  const admin = await requireAdmin();
  if (!params.name.trim()) return { error: 'Name is required' };

  const { raw, prefix, hash } = generateApiKey();
  const db = getDb();

  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await db.insert(apiKeys).values({
    userId: params.userId ?? null,
    name: params.name.trim(),
    keyPrefix: prefix,
    keyHash: hash,
    scopes: params.scopes ?? ['messages:read'],
    expiresAt,
  });

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'api_key.create',
    resource: 'api_key',
    metadata: { name: params.name, prefix, userId: params.userId, scopes: params.scopes },
  });

  revalidatePath('/admin/api');
  return { success: true, rawKey: raw, prefix };
}

export async function revokeApiKeyAdminAction(keyId: number) {
  const admin = await requireAdmin();
  const db = getDb();

  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'api_key.revoke',
    resource: 'api_key',
    resourceId: String(keyId),
  });

  revalidatePath('/admin/api');
  return { success: true };
}

export async function listUsersForApiKeySelect() {
  await requireAdmin();
  const db = getDb();
  return db.select({ id: users.id, email: users.email }).from(users).limit(200);
}