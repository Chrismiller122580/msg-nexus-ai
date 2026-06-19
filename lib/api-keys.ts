import crypto from 'crypto';
import { getDb, apiKeys } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';

const KEY_PREFIX = 'mnx_';

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const secret = crypto.randomBytes(24).toString('base64url');
  const raw = `${KEY_PREFIX}${secret}`;
  const prefix = raw.slice(0, 12);
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function validateApiKey(raw: string): Promise<{
  id: number;
  userId: number | null;
  scopes: string[];
} | null> {
  if (!raw.startsWith(KEY_PREFIX)) return null;

  const db = getDb();
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 12);

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!key) return null;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

  return {
    id: key.id,
    userId: key.userId,
    scopes: Array.isArray(key.scopes) ? key.scopes : [],
  };
}