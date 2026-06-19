import { getDb, whatsappConnections } from '@/db';
import { eq } from 'drizzle-orm';

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function normalizeWhatsAppPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits;
}

export async function fetchRecentWhatsAppMessages(phoneNumber: string, max = 25) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return [];

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages?limit=${max}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];

  const data = await res.json() as {
    data?: Array<{
      id: string;
      from?: string;
      timestamp?: string;
      type?: string;
      text?: { body?: string };
    }>;
  };

  if (!data.data) return [];

  const normalized = normalizeWhatsAppPhone(phoneNumber);
  return data.data
    .filter((m) => !normalized || normalizeWhatsAppPhone(m.from || '') === normalized || !m.from)
    .map((m) => ({
      externalId: m.id,
      from: m.from ? `+${m.from}` : 'WhatsApp',
      body: m.text?.body || '(WhatsApp message)',
      timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
    }));
}