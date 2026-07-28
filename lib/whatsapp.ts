export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
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

/** Lightweight Graph call to confirm the access token + phone number id still work. */
export async function verifyWhatsAppCredentials(): Promise<{ ok: true; displayPhone?: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required.' };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error?.message || `WhatsApp Graph API error HTTP ${res.status}`,
      };
    }
    return { ok: true, displayPhone: data.display_phone_number };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to verify WhatsApp credentials',
    };
  }
}
