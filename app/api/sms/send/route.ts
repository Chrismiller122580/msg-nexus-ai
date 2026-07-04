import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { sendSmsForUser } from '@/lib/sms-send';
import { normalizePhoneNumber } from '@/lib/twilio';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { to?: string; message?: string };
  const to = body.to?.trim();
  const message = body.message?.trim();

  if (!to || !message) {
    return NextResponse.json({ error: 'to and message are required' }, { status: 400 });
  }

  const normalizedTo = normalizePhoneNumber(to);
  if (normalizedTo.length < 11) {
    return NextResponse.json({ error: 'Invalid phone number. Use E.164 format with country code.' }, { status: 400 });
  }

  const result = await sendSmsForUser(user.id, normalizedTo, message);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, sid: result.sid });
}