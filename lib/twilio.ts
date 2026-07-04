import crypto from 'crypto';

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
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
    .update(sorted)
    .digest('base64');

  return expected === signature;
}

interface TwilioMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  date_sent?: string;
  date_created?: string;
}

export async function fetchTwilioMessagesForPhone(phoneNumber: string, max = 25) {
  if (!isTwilioConfigured()) return [];

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const encoded = encodeURIComponent(phoneNumber);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=${max}&To=${encoded}`;

  const res = await fetch(url, {
    headers: { Authorization: getTwilioAuthHeader() },
  });
  if (!res.ok) return [];

  const data = await res.json() as { messages?: TwilioMessage[] };
  const inbound = data.messages || [];

  const urlFrom = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=${max}&From=${encoded}`;
  const resFrom = await fetch(urlFrom, {
    headers: { Authorization: getTwilioAuthHeader() },
  });
  const dataFrom = resFrom.ok
    ? await resFrom.json() as { messages?: TwilioMessage[] }
    : { messages: [] };

  const combined = [...inbound, ...(dataFrom.messages || [])];
  const seen = new Set<string>();

  return combined.filter((m) => {
    if (seen.has(m.sid)) return false;
    seen.add(m.sid);
    return true;
  }).map((m) => ({
    externalId: m.sid,
    from: m.from,
    body: m.body || '(empty SMS)',
    timestamp: m.date_sent || m.date_created || new Date().toISOString(),
  }));
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

export function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (input.startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}