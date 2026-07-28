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

/** Server Twilio line from env (E.164), if configured. */
export function getTwilioEnvPhoneNumber(): string | null {
  const raw = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!raw) return null;
  const n = normalizePhoneNumber(raw);
  return n || null;
}

function toIsoTimestamp(value?: string | null): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Resolve which phone to query on the Twilio Messages API.
 * Always prefer TWILIO_PHONE_NUMBER — that is the account line that owns SMS history.
 * User-entered connect phone is only used when env is unset.
 */
export function resolveTwilioSyncLine(connectedPhone?: string | null): string | null {
  const envLine = getTwilioEnvPhoneNumber();
  if (envLine) return envLine;
  if (connectedPhone?.trim()) {
    const n = normalizePhoneNumber(connectedPhone.trim());
    return n || null;
  }
  return null;
}

function mapTwilioMessages(rows: TwilioMessage[]): TwilioFetchedMessage[] {
  const seen = new Set<string>();
  const messages: TwilioFetchedMessage[] = [];
  for (const m of rows) {
    if (!m.sid || seen.has(m.sid)) continue;
    seen.add(m.sid);
    messages.push({
      externalId: m.sid,
      from: m.from,
      body: m.body || '(empty SMS)',
      timestamp: toIsoTimestamp(m.date_sent || m.date_created),
    });
  }
  return messages;
}

export async function fetchTwilioMessagesForPhone(
  phoneNumber: string,
  max = 50
): Promise<{ messages: TwilioFetchedMessage[]; error?: string; line?: string }> {
  if (!isTwilioConfigured()) {
    return { messages: [], error: 'Twilio is not configured on the server.' };
  }

  const line = resolveTwilioSyncLine(phoneNumber);
  if (!line) {
    return { messages: [], error: 'No valid Twilio phone number to sync. Set TWILIO_PHONE_NUMBER.' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const encoded = encodeURIComponent(line);

  async function list(query?: string): Promise<{ messages: TwilioMessage[]; error?: string }> {
    const filter = query ? `&${query}=${encoded}` : '';
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=${max}${filter}`;
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

  // Prefer messages involving the Twilio line (inbound To=line + outbound From=line)
  const to = await list('To');
  if (to.error) return { messages: [], error: to.error, line };
  const from = await list('From');
  if (from.error) return { messages: [], error: from.error, line };

  let combined = [...to.messages, ...from.messages];

  // Fallback: unfiltered recent account messages (helps if number formatting diverges)
  if (combined.length === 0) {
    const all = await list();
    if (all.error) return { messages: [], error: all.error, line };
    combined = all.messages;
  }

  return { messages: mapTwilioMessages(combined), line };
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

