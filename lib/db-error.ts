export function getDbErrorMessage(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('DATABASE_URL')) {
    return 'Database not configured. Copy .env.example to .env.local, add DATABASE_URL, and run npm run db:push.';
  }
  return null;
}
