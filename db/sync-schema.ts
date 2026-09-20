import { pgTable, serial, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { users } from './schema';

export const syncRuns = pgTable(
  'sync_runs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    imported: integer('imported').notNull().default(0),
    errors: text('errors'),
    details: jsonb('details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCreated: index('sync_runs_user_created_idx').on(table.userId, table.createdAt),
  })
);
