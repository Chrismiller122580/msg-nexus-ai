import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from '@/lib/database-url';
import * as schema from './schema';
import * as syncSchema from './sync-schema';

let _db: any = null;

export function getDb() {
  if (!_db) {
    const url = getDatabaseUrl();

    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Add your Postgres connection string (e.g. from Vercel Storage / Neon) to environment variables.'
      );
    }

    const useNeonHttp = url.includes('neon.tech') || url.startsWith('https://');

    if (useNeonHttp) {
      const sql = neon(url);
      _db = drizzleNeon(sql, { schema: { ...schema, ...syncSchema } });
    } else {
      const client = postgres(url, { max: 3, idle_timeout: 20 });
      _db = drizzlePg(client, { schema: { ...schema, ...syncSchema } });
    }
  }
  return _db;
}

export * from './schema';
export * from './sync-schema';
