import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import { getDb, twilioConnections } from '@/db';
import { isTwilioSendConfigured, normalizePhoneNumber } from '@/lib/twilio';
import { sendSmsForUser } from '@/lib/sms-send';
import { eq } from 'drizzle-orm';

function extractApiKey(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-api-key')?.trim() ?? null;
}

export async function POST(request: Request) {
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return NextResponse.json(
      { error: 'Missing API key. Use Authorization: Bearer mnx_... or X-API-Key header.' },
      { status: 401 }
    );
  }

  const key = await validateApiKey(rawKey);
  if (!key) {
    return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
  }

  if (!key.scopes.includes('sms:send') && !key.scopes.includes('messages:write')) {
    return NextResponse.json(
      { error: 'Insufficient scope. Required: sms:send or messages:write' },
      { status: 403 }
    );
  }

  if (!key.userId) {
    return NextResponse.json({ error: 'User-scoped API key required' }, { status: 403 });
  }

  if (!isTwilioSendConfigured()) {
    return NextResponse.json(
      { error: 'Twilio send not configured on server (TWILIO_PHONE_NUMBER required)' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({})) as { to?: string; message?: string };
  const to = body.to?.trim();
  const message = body.message?.trim();

  if (!to || !message) {
    return NextResponse.json({ error: 'to and message are required' }, { status: 400 });
  }

  const db = getDb();
  const [conn] = await db
    .select()
    .from(twilioConnections)
    .where(eq(twilioConnections.userId, key.userId))
    .limit(1);

  if (!conn) {
    return NextResponse.json({ error: 'SMS not connected for this user' }, { status: 400 });
  }

  const result = await sendSmsForUser(key.userId, normalizePhoneNumber(to), message);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, sid: result.sid });
}