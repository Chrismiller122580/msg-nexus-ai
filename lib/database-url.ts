/** Vercel Neon Storage often exposes POSTGRES_* instead of DATABASE_URL. */
const VERCEL_DB_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL_NO_SSL',
  'POSTGRES_PRISMA_URL',
  'NEON_DATABASE_URL',
] as const;

function firstEnv(keys: readonly string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

/**
 * Resolves the active Postgres connection string.
 * - Production (Vercel): DATABASE_URL or Neon POSTGRES_* vars from Vercel Storage.
 * - Local: default DATABASE_URL points at local Postgres; set USE_NEON=true + NEON_DATABASE_URL to use Neon.
 */
export function getDatabaseUrl(): string {
  const useNeon = process.env.USE_NEON === 'true' || process.env.USE_NEON === '1';
  const neonUrl = process.env.NEON_DATABASE_URL?.trim();
  const primary = firstEnv(VERCEL_DB_KEYS);

  if (useNeon && neonUrl) return neonUrl;
  if (primary.includes('neon.tech') || primary.startsWith('https://')) return primary;
  if (neonUrl && !primary) return neonUrl;
  return primary;
}

export function isNeonUrl(url: string): boolean {
  return url.includes('neon.tech') || url.startsWith('https://');
}

export function getDatabaseLabel(url: string): 'neon' | 'local' | 'postgres' {
  if (!url) return 'postgres';
  if (isNeonUrl(url)) return 'neon';
  if (url.includes('127.0.0.1') || url.includes('localhost')) return 'local';
  return 'postgres';
}