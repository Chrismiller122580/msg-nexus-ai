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

/** Send a text message via WhatsApp Cloud API. `to` is E.164 digits or +digits. */
export async function sendWhatsAppText(
  to: string,
  text: string
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp is not configured on the server.' };
  }
  const body = text.trim();
  if (!body) return { ok: false, error: 'Message cannot be empty.' };
  const toDigits = normalizeWhatsAppPhone(to);
  if (toDigits.length < 10) return { ok: false, error: 'Enter a valid destination phone number.' };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toDigits,
          type: 'text',
          text: { body },
        }),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: data.error?.message || `WhatsApp send failed (HTTP ${res.status})` };
    }
    return { ok: true, messageId: data.messages?.[0]?.id || `wa-out-${Date.now()}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'WhatsApp send failed' };
  }
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
