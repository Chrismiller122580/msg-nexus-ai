import { NextResponse } from 'next/server';
import { getDb, twilioConnections } from '@/db';
import { validateTwilioSignature } from '@/lib/twilio';
import { ingestTwilioWebhookMessage } from '@/lib/twilio-sync';
import { getAppUrl } from '@/lib/app-url';

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = String(value);
  }

  const signature = request.headers.get('x-twilio-signature');
  const url = `${getAppUrl()}/api/webhooks/twilio`;

  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(signature, url, params)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const messageSid = params.MessageSid;
  const from = params.From;
  const body = params.Body;
  const to = params.To;

  if (!messageSid || !from) {
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const db = getDb();
  const connections = await db.select().from(twilioConnections);

  for (const conn of connections) {
    const matchesUser =
      to === conn.phoneNumber ||
      from === conn.phoneNumber ||
      connections.length === 1;

    if (!matchesUser) continue;

    await ingestTwilioWebhookMessage(conn.userId, {
      MessageSid: messageSid,
      From: from,
      Body: body || '',
      DateCreated: params.DateCreated,
    });
    break;
  }

  return new NextResponse('<Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
}