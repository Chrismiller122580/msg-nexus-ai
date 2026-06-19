import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from '@/lib/database-url';
import * as schema from './schema';

let _db: any = null;

export function getDb() {
  if (!_db) {
    const url = getDatabaseUrl();

    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Add your Postgres connection string (e.g. from Vercel Storage / Neon) to environment variables.'
      );
    }

    // Use standard postgres-js driver for local Postgres or regular connections.
    // Use neon-http only for explicit Neon serverless URLs (https style or .neon.tech with special hints).
    const useNeonHttp = url.includes('neon.tech') || url.startsWith('https://');

    if (useNeonHttp) {
      const sql = neon(url);
      _db = drizzleNeon(sql, { schema });
    } else {
      // Standard libpq-style URL works great with local pg (and also Neon over TCP)
      const client = postgres(url, { max: 3, idle_timeout: 20 });
      _db = drizzlePg(client, { schema });
    }
  }
  return _db;
}

export * from './schema';