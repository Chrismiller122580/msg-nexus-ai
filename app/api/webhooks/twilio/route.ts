import { NextResponse } from 'next/server';
import { getDb, twilioConnections } from '@/db';
import { validateTwilioSignature } from '@/lib/twilio';
import { getTwilioAutoReplyMessage, twimlEmptyResponse, twimlMessageResponse } from '@/lib/twilio-twiml';
import { ingestTwilioWebhookMessage } from '@/lib/twilio-sync';
import { getAppUrl } from '@/lib/app-url';

function twimlResponse(body: string) {
  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

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
    return twimlResponse(twimlEmptyResponse());
  }

  const db = getDb();
  const connections = await db.select().from(twilioConnections);
  let ingested = false;

  for (const conn of connections) {
    const matchesUser =
      to === conn.phoneNumber ||
      from === conn.phoneNumber ||
      connections.length === 1;

    if (!matchesUser) continue;

    await ingestTwilioWebhookMessage(conn.userId, {
      MessageSid: messageSid,
      From: from,
      To: to,
      Body: body || '',
      DateCreated: params.DateCreated,
      direction: 'in',
      status: 'received',
    });
    ingested = true;
    break;
  }

  const autoReply = getTwilioAutoReplyMessage();
  if (ingested && autoReply) {
    return twimlResponse(twimlMessageResponse(autoReply));
  }

  return twimlResponse(twimlEmptyResponse());
}