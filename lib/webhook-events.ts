export const WEBHOOK_EVENTS = [
  'user.created',
  'message.created',
  'subscription.updated',
  'connection.synced',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];