import crypto from 'crypto';
import { getAppUrl } from '@/lib/app-url';
import { normalizePhoneNumber, phonesMatch } from '@/lib/phone';

export { normalizePhoneNumber, phonesMatch };

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim()
  );
}

export function isTwilioSendConfigured(): boolean {
  return isTwilioConfigured() && Boolean(process.env.TWILIO_PHONE_NUMBER?.trim());
}

export function getTwilioAuthHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature || !process.env.TWILIO_AUTH_TOKEN) return false;

  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = crypto
    .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
    .update(Buffer.from(sorted, 'utf8'))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return expected === signature;
  }
}

/** Twilio signs the exact public URL configured in the console — try common variants. */
export function validateTwilioSignatureForRequest(
  signature: string | null,
  request: Request,
  params: Record<string, string>
): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!signature) return false;

  const requestUrl = request.url.split('?')[0];
  const app = getAppUrl().replace(/\/$/, '');
  const candidates = Array.from(
    new Set([
      requestUrl,
      `${app}/api/webhooks/twilio`,
      'https://www.msgnexus.ai/api/webhooks/twilio',
      'https://msgnexus.ai/api/webhooks/twilio',
    ])
  );

  return candidates.some((url) => validateTwilioSignature(signature, url, params));
}

interface TwilioMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  date_sent?: string;
  date_created?: string;
}

export type TwilioFetchedMessage = {
  externalId: string;
  from: string;
  body: string;
  timestamp: string;
};

export async function fetchTwilioMessagesForPhone(
  phoneNumber: string,
  max = 25
): Promise<{ messages: TwilioFetchedMessage[]; error?: string }> {
  if (!isTwilioConfigured()) {
    return { messages: [], error: 'Twilio is not configured on the server.' };
  }

  // Prefer the server Twilio number (matches Twilio Console) when the user
  // connected the same line under a slightly different format.
  const envPhone = process.env.TWILIO_PHONE_NUMBER?.trim();
  const normalizedUser = normalizePhoneNumber(phoneNumber);
  const line =
    envPhone && phonesMatch(envPhone, normalizedUser)
      ? normalizePhoneNumber(envPhone)
      : normalizedUser || (envPhone ? normalizePhoneNumber(envPhone) : '');

  if (!line) {
    return { messages: [], error: 'No valid Twilio phone number to sync.' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const encoded = encodeURIComponent(line);

  async function list(query: string): Promise<{ messages: TwilioMessage[]; error?: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=${max}&${query}=${encoded}`;
    const res = await fetch(url, { headers: { Authorization: getTwilioAuthHeader() } });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: TwilioMessage[];
      message?: string;
      code?: number;
    };
    if (!res.ok) {
      return {
        messages: [],
        error: data.message || `Twilio API error HTTP ${res.status}`,
      };
    }
    return { messages: data.messages || [] };
  }

  const to = await list('To');
  if (to.error) return { messages: [], error: to.error };
  const from = await list('From');
  if (from.error) return { messages: [], error: from.error };

  const combined = [...to.messages, ...from.messages];
  const seen = new Set<string>();

  const messages = combined
    .filter((m) => {
      if (seen.has(m.sid)) return false;
      seen.add(m.sid);
      return true;
    })
    .map((m) => ({
      externalId: m.sid,
      from: m.from,
      body: m.body || '(empty SMS)',
      timestamp: m.date_sent || m.date_created || new Date().toISOString(),
    }));

  return { messages };
}

export async function sendTwilioSms(
  to: string,
  message: string
): Promise<{ sid: string; status: string; to: string; from: string }> {
  if (!isTwilioSendConfigured()) {
    throw new Error('Twilio send is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
  }

  const normalizedTo = normalizePhoneNumber(to.trim());
  const from = process.env.TWILIO_PHONE_NUMBER!.trim();
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getTwilioAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: normalizedTo,
      From: from,
      Body: message,
    }),
  });

  const data = await res.json().catch(() => ({})) as {
    sid?: string;
    status?: string;
    message?: string;
    to?: string;
    from?: string;
  };

  if (!res.ok) {
    throw new Error(data.message || `Twilio send failed (HTTP ${res.status})`);
  }

  return {
    sid: data.sid || '',
    status: data.status || 'queued',
    to: data.to || normalizedTo,
    from: data.from || from,
  };
}

