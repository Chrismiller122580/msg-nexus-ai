import { pgTable, serial, text, timestamp, jsonb, boolean, numeric, integer, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role').notNull().default('user'), // user | support | billing | admin
  status: text('status').notNull().default('active'), // active | suspended
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  plan: text('plan').notNull().default('free'), // free | pro | enterprise
  status: text('status').notNull().default('active'), // active | trialing | cancelled | past_due
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  externalCustomerId: text('external_customer_id'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: jsonb('events').$type<string[]>().default([]),
  enabled: boolean('enabled').default(true).notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userlensRuns = pgTable('userlens_runs', {
  id: serial('id').primaryKey(),
  externalId: text('external_id'),
  url: text('url').notNull(),
  tests: jsonb('tests').$type<string[]>().default([]),
  status: text('status').notNull().default('pending'),
  triggeredByUserId: integer('triggered_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  smokeOk: boolean('smoke_ok'),
  a11yViolations: integer('a11y_violations'),
  lighthousePerformance: integer('lighthouse_performance'),
  lighthouseAccessibility: integer('lighthouse_accessibility'),
  lighthouseSeo: integer('lighthouse_seo'),
  lighthouseBestPractices: integer('lighthouse_best_practices'),
  durationMs: integer('duration_ms'),
  results: jsonb('results'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: serial('id').primaryKey(),
  webhookId: integer('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: jsonb('payload'),
  status: text('status').notNull(),
  responseCode: integer('response_code'),
  responseBody: text('response_body'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  scopes: jsonb('scopes').$type<string[]>().default([]),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const connectedAccounts = pgTable('connected_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platformId: text('platform_id').notNull(),
  identifier: text('identifier').notNull(), // e.g. "john@gmail.com", "+15551234567", "work-account"
  label: text('label'), // optional friendly name
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserPlatformIdentifier: uniqueIndex('unique_user_platform_identifier').on(table.userId, table.platformId, table.identifier),
}));

export const messages = pgTable('messages', {
  id: text('id').primaryKey(), // we keep the generated client ids for now
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platformId: text('platform_id').notNull(),
  timestamp: text('timestamp').notNull(),
  from: text('from').notNull(),
  body: text('body').notNull(),
  subject: text('subject'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const smsMessages = pgTable('sms_messages', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  from: text('from').notNull(),
  to: text('to'),
  body: text('body').notNull(),
  direction: text('direction').notNull().default('in'), // in | out
  status: text('status').notNull().default('received'),
  messageSid: text('message_sid'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueMessageSid: uniqueIndex('sms_messages_message_sid_unique').on(table.messageSid),
}));

export const magicLinks = pgTable('magic_links', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gmailConnections = pgTable('gmail_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  email: text('email').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const outlookConnections = pgTable('outlook_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  email: text('email').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const twilioConnections = pgTable('twilio_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  phoneNumber: text('phone_number').notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const slackConnections = pgTable('slack_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  teamId: text('team_id'),
  teamName: text('team_name'),
  userName: text('user_name').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const discordConnections = pgTable('discord_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  discordUserId: text('discord_user_id').notNull(),
  userName: text('user_name').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const telegramConnections = pgTable('telegram_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  chatId: text('chat_id'),
  userName: text('user_name'),
  linkCode: text('link_code'),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const whatsappConnections = pgTable('whatsapp_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  phoneNumber: text('phone_number').notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const xConnections = pgTable('x_connections', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  xUserId: text('x_user_id').notNull(),
  userName: text('user_name').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insights = pgTable('insights', {
  id: serial('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }).unique(),
  category: text('category').notNull(),
  amount: numeric('amount'),
  currency: text('currency'),
  vendor: text('vendor'),
  dueDate: text('due_date'),
  isRecurring: boolean('is_recurring'),
  confidence: numeric('confidence'),
  summary: text('summary'),
  entities: jsonb('entities'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Insight = typeof insights.$inferSelect;
