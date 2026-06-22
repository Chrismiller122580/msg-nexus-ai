function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? err.cause.message : '';
    return [err.message, cause].filter(Boolean).join(' ');
  }
  return String(err);
}

export function getDbErrorMessage(err: unknown): string | null {
  const message = extractMessage(err);

  if (message.includes('DATABASE_URL') || message.includes('database URL')) {
    return 'Database not configured. Copy .env.example to .env.local, add DATABASE_URL, and run npm run db:push.';
  }
  if (message.includes('ECONNREFUSED') || message.includes('connect ENOENT')) {
    return 'Database is unreachable. Start Postgres or set DATABASE_URL to your Neon URL, then run npm run db:push.';
  }
  if (message.includes('28P01') || message.includes('password authentication failed')) {
    return 'Database authentication failed. Check DATABASE_URL credentials in .env.local.';
  }
  if (message.includes('Failed query') || message.includes('relation') && message.includes('does not exist')) {
    return 'Database schema missing. Run npm run db:push against your DATABASE_URL.';
  }

  return null;
}
