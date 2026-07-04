import { getDb, whatsappConnections } from '@/db';
import { eq } from 'drizzle-orm';

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function normalizeWhatsAppPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits;
}

export type WhatsAppFetchedMessage = {
  externalId: string;
  from: string;
  body: string;
  timestamp: string;
};

/** WhatsApp Cloud API does not expose a message history list endpoint. Use webhooks for inbound. */
export async function fetchRecentWhatsAppMessages(
  _phoneNumber: string,
  _max = 25
): Promise<WhatsAppFetchedMessage[]> {
  return [];
}